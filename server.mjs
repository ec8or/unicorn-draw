import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const LATEST_PATH = path.join(DATA_DIR, "latest.json");

const PUBLIC_ROOT = __dirname; // serve repo root as static files

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

function looksLikeDrawingJson(d) {
  return (
    d &&
    d.w === 32 &&
    d.h === 32 &&
    Array.isArray(d.palette) &&
    Array.isArray(d.pixels) &&
    d.pixels.length === 1024
  );
}

async function handleApi(req, res) {
  if (req.url === "/api/latest" && req.method === "GET") {
    try {
      const text = await fs.readFile(LATEST_PATH, "utf-8");
      noStore(res);
      return send(res, 200, text, "application/json; charset=utf-8");
    } catch {
      noStore(res);
      return send(res, 404, JSON.stringify({ error: "no latest yet" }) + "\n", "application/json; charset=utf-8");
    }
  }

  if (req.url === "/api/latest" && (req.method === "POST" || req.method === "PUT")) {
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

  return false;
}

function safeResolve(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const p = path.normalize(clean).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(root, p);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";

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
  // basic security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");

  const apiHandled = await handleApi(req, res);
  if (apiHandled !== false) return;
  return serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`unicorn-draw listening on :${PORT}`);
  console.log(`DATA_DIR=${DATA_DIR}`);
});


