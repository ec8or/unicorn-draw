import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const LATEST_PATH = path.join(DATA_DIR, "latest.json");
const ARTWORKS_PATH = path.join(DATA_DIR, "artworks.json");
const DISPLAY_STATE_PATH = path.join(DATA_DIR, "display_state.json");
const API_SECRET = process.env.API_SECRET || "06911ead4a05f7b5ee1ac68379a7e819aff8c7902edc6a441eaa84bea32ea90f";

const PUBLIC_ROOT = __dirname; // serve repo root as static files

// Rate limiting: track submissions per IP
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max submissions per window

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || 
         req.headers["x-real-ip"] || 
         req.socket.remoteAddress || 
         "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimit.get(ip);
  
  if (!record || now - record.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { firstRequest: now, count: 1 });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimit.entries()) {
    if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
      rateLimit.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

function sanitizeString(str, maxLength = 100) {
  if (typeof str !== "string") return "";
  // Remove control characters, trim, and limit length
  return str
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.end(body);
}

async function readBody(req, limitBytes = 200_000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error("payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readArtworks() {
  try {
    const text = await fs.readFile(ARTWORKS_PATH, "utf-8");
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function writeArtworks(artworks) {
  await ensureDataDir();
  // Limit total artworks to prevent disk exhaustion (keep last 1000)
  const limited = artworks.slice(-1000);
  await fs.writeFile(ARTWORKS_PATH, JSON.stringify(limited, null, 2) + "\n", "utf-8");
}

async function readDisplayState() {
  try {
    const text = await fs.readFile(DISPLAY_STATE_PATH, "utf-8");
    return JSON.parse(text);
  } catch {
    return { current_id: null };
  }
}

async function writeDisplayState(state) {
  await ensureDataDir();
  await fs.writeFile(DISPLAY_STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function looksLikeDrawingJson(d) {
  if (!d || typeof d !== "object") return false;
  if (d.w !== 32 || d.h !== 32) return false;
  if (!Array.isArray(d.palette) || !Array.isArray(d.pixels)) return false;
  if (d.pixels.length !== 1024) return false;
  
  // Validate palette: must be array of valid hex colors
  if (d.palette.length > 256) return false;
  for (const color of d.palette) {
    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return false;
    }
  }
  
  // Validate pixels: must be numbers within palette range
  const maxPaletteIndex = d.palette.length - 1;
  for (const pixel of d.pixels) {
    const idx = Number(pixel);
    if (!Number.isInteger(idx) || idx < 0 || idx > maxPaletteIndex) {
      return false;
    }
  }
  
  return true;
}

async function handleApi(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  // Legacy /api/latest endpoint (keep for backward compatibility)
  if (pathname === "/api/latest" && req.method === "GET") {
    try {
      const text = await fs.readFile(LATEST_PATH, "utf-8");
      noStore(res);
      return send(res, 200, text, "application/json; charset=utf-8");
    } catch {
      noStore(res);
      return send(res, 404, JSON.stringify({ error: "no latest yet" }) + "\n", "application/json; charset=utf-8");
    }
  }

  if (pathname === "/api/latest" && (req.method === "POST" || req.method === "PUT")) {
    try {
      await ensureDataDir();
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      if (!looksLikeDrawingJson(parsed)) {
        return send(res, 400, JSON.stringify({ error: "invalid drawing shape" }) + "\n", "application/json; charset=utf-8");
      }
      // normalize: keep file compact-ish but readable
      await fs.writeFile(LATEST_PATH, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
      noStore(res);
      return send(res, 200, JSON.stringify({ ok: true }) + "\n", "application/json; charset=utf-8");
    } catch (e) {
      return send(res, 400, JSON.stringify({ error: "bad request" }) + "\n", "application/json; charset=utf-8");
    }
  }

  // POST /api/submit - Submit new artwork
  if (pathname === "/api/submit" && req.method === "POST") {
    const clientIp = getClientIp(req);
    
    // Rate limiting
    if (!checkRateLimit(clientIp)) {
      return send(res, 429, JSON.stringify({ error: "rate limit exceeded" }) + "\n", "application/json; charset=utf-8");
    }
    
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      
      // Validate and sanitize artist name
      if (!body.artist || typeof body.artist !== "string") {
        return send(res, 400, JSON.stringify({ error: "artist name required" }) + "\n", "application/json; charset=utf-8");
      }
      
      const sanitizedArtist = sanitizeString(body.artist, 50);
      if (sanitizedArtist.length === 0) {
        return send(res, 400, JSON.stringify({ error: "artist name required" }) + "\n", "application/json; charset=utf-8");
      }
      
      if (!looksLikeDrawingJson(body.drawing)) {
        return send(res, 400, JSON.stringify({ error: "invalid drawing shape" }) + "\n", "application/json; charset=utf-8");
      }
      
      const artworks = await readArtworks();
      const artwork = {
        id: generateId(),
        artist: sanitizedArtist,
        created_at: Date.now(),
        display_count: 0,
        drawing: body.drawing,
      };
      artworks.push(artwork);
      await writeArtworks(artworks);
      noStore(res);
      return send(res, 200, JSON.stringify({ ok: true, id: artwork.id }) + "\n", "application/json; charset=utf-8");
    } catch (e) {
      // Don't leak error details
      return send(res, 400, JSON.stringify({ error: "bad request" }) + "\n", "application/json; charset=utf-8");
    }
  }

  // GET /api/gallery - Get all artworks (without full pixel data)
  if (pathname === "/api/gallery" && req.method === "GET") {
    try {
      const artworks = await readArtworks();
      const gallery = artworks
        .map((a) => ({
          id: a.id,
          artist: sanitizeString(a.artist || "Anonymous", 50), // Sanitize on output too
          created_at: a.created_at,
          display_count: a.display_count,
        }))
        .sort((a, b) => b.created_at - a.created_at);
      noStore(res);
      return send(res, 200, JSON.stringify(gallery) + "\n", "application/json; charset=utf-8");
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: "server error" }) + "\n", "application/json; charset=utf-8");
    }
  }

  // GET /api/artwork/:id - Get single artwork with full drawing
  if (pathname.startsWith("/api/artwork/") && req.method === "GET") {
    try {
      const id = pathname.slice("/api/artwork/".length);
      // Validate ID format (alphanumeric, reasonable length)
      if (!/^[a-z0-9]{1,30}$/i.test(id)) {
        return send(res, 400, JSON.stringify({ error: "invalid id" }) + "\n", "application/json; charset=utf-8");
      }
      
      const artworks = await readArtworks();
      const artwork = artworks.find((a) => a.id === id);
      if (!artwork) {
        return send(res, 404, JSON.stringify({ error: "not found" }) + "\n", "application/json; charset=utf-8");
      }
      
      // Sanitize artist name on output
      artwork.artist = sanitizeString(artwork.artist || "Anonymous", 50);
      
      noStore(res);
      return send(res, 200, JSON.stringify(artwork) + "\n", "application/json; charset=utf-8");
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: "server error" }) + "\n", "application/json; charset=utf-8");
    }
  }

  // GET /api/current - Get currently displayed artwork
  if (pathname === "/api/current" && req.method === "GET") {
    try {
      const state = await readDisplayState();
      if (!state.current_id) {
        return send(res, 404, JSON.stringify({ error: "no current artwork" }) + "\n", "application/json; charset=utf-8");
      }
      const artworks = await readArtworks();
      const artwork = artworks.find((a) => a.id === state.current_id);
      if (!artwork) {
        return send(res, 404, JSON.stringify({ error: "current artwork not found" }) + "\n", "application/json; charset=utf-8");
      }
      
      // Sanitize artist name on output
      artwork.artist = sanitizeString(artwork.artist || "Anonymous", 50);
      
      noStore(res);
      return send(res, 200, JSON.stringify(artwork) + "\n", "application/json; charset=utf-8");
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: "server error" }) + "\n", "application/json; charset=utf-8");
    }
  }

  // GET /api/next?secret=xxx - Advance to next artwork (password protected)
  if (pathname === "/api/next" && req.method === "GET") {
    try {
      const secret = url.searchParams.get("secret");
      if (secret !== API_SECRET) {
        return send(res, 401, JSON.stringify({ error: "unauthorized" }) + "\n", "application/json; charset=utf-8");
      }
      const artworks = await readArtworks();
      if (artworks.length === 0) {
        return send(res, 404, JSON.stringify({ error: "no artworks available" }) + "\n", "application/json; charset=utf-8");
      }
      // Fair rotation: pick artwork with lowest display_count, on tie pick oldest created_at
      artworks.sort((a, b) => {
        if (a.display_count !== b.display_count) {
          return a.display_count - b.display_count;
        }
        return a.created_at - b.created_at;
      });
      const next = artworks[0];
      next.display_count++;
      await writeArtworks(artworks);
      const state = { current_id: next.id };
      await writeDisplayState(state);
      
      // Calculate total views across all artworks
      const totalViews = artworks.reduce((sum, a) => sum + a.display_count, 0);
      
      noStore(res);
      return send(res, 200, JSON.stringify({ ...next, total_views: totalViews }) + "\n", "application/json; charset=utf-8");
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: "server error" }) + "\n", "application/json; charset=utf-8");
    }
  }

  return false;
}

function safeResolve(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const p = path.normalize(clean).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.join(root, p);
  // Ensure resolved path is still within root directory
  if (!resolved.startsWith(path.resolve(root))) {
    return null;
  }
  return resolved;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";

  // Don't serve Python files or examples directory
  if (pathname.startsWith("/examples/") || pathname.endsWith(".py")) {
    return send(res, 404, "not found\n");
  }

  // Back-compat: allow read mode to fetch the same JSON via a stable path.
  if (pathname === "/drawings/latest.json") {
    try {
      const text = await fs.readFile(LATEST_PATH, "utf-8");
      noStore(res);
      return send(res, 200, text, "application/json; charset=utf-8");
    } catch {
      // fall back to repo sample if no one has published yet
      const sample = await fs.readFile(path.join(PUBLIC_ROOT, "drawings/latest.json"), "utf-8");
      noStore(res);
      return send(res, 200, sample, "application/json; charset=utf-8");
    }
  }

  const filePath = safeResolve(PUBLIC_ROOT, pathname);
  if (!filePath) {
    return send(res, 403, "forbidden\n");
  }
  
  try {
    const st = await fs.stat(filePath);
    if (st.isDirectory()) {
      const idx = path.join(filePath, "index.html");
      const text = await fs.readFile(idx);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(text);
    }
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const ct =
      ext === ".html" ? "text/html; charset=utf-8" :
      ext === ".css" ? "text/css; charset=utf-8" :
      ext === ".js" ? "text/javascript; charset=utf-8" :
      ext === ".json" ? "application/json; charset=utf-8" :
      "application/octet-stream";
    res.statusCode = 200;
    res.setHeader("Content-Type", ct);
    return res.end(buf);
  } catch {
    return send(res, 404, "not found\n");
  }
}

const server = http.createServer(async (req, res) => {
  // Enhanced security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:;");
  
  // Request timeout (30 seconds)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.statusCode = 408;
      res.end("Request timeout\n");
    }
  }, 30000);
  
  try {
    const apiHandled = await handleApi(req, res);
    if (apiHandled !== false) {
      clearTimeout(timeout);
      return;
    }
    await serveStatic(req, res);
    clearTimeout(timeout);
  } catch (e) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      send(res, 500, "Internal server error\n");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`unicorn-draw listening on :${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
});
