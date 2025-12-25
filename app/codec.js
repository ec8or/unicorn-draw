// unicorn-draw codec + data helpers
// Goal: simple format for both browser share-links and Pico-friendly JSON.

export const W = 32;
export const H = 32;
export const N = W * H;

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function normalizeHex(hex) {
  if (!hex) return "#000000";
  const h = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(h)) return h;
  return "#000000";
}

export function makeBlankDrawing(bg = "#000000") {
  // palette[0] is background by convention.
  const palette = [normalizeHex(bg), "#ffffff"];
  const pixels = new Array(N).fill(0);
  return { w: W, h: H, palette, pixels };
}

export function ensureDrawingShape(d) {
  if (!d || d.w !== W || d.h !== H || !Array.isArray(d.palette) || !Array.isArray(d.pixels)) {
    return makeBlankDrawing("#000000");
  }
  if (d.pixels.length !== N) {
    const fixed = new Array(N).fill(0);
    for (let i = 0; i < Math.min(N, d.pixels.length); i++) fixed[i] = clamp(Number(d.pixels[i]) | 0, 0, 255);
    return { w: W, h: H, palette: d.palette.map(normalizeHex), pixels: fixed };
  }
  return {
    w: W,
    h: H,
    palette: d.palette.map(normalizeHex),
    pixels: d.pixels.map((x) => clamp(Number(x) | 0, 0, 255)),
  };
}

export function paletteIndexForColor(drawing, hex) {
  const h = normalizeHex(hex);
  const idx = drawing.palette.indexOf(h);
  if (idx !== -1) return idx;
  drawing.palette.push(h);
  return drawing.palette.length - 1;
}

// --- URL payload ---
// Payload structure (binary):
// [1 byte version=1]
// [1 byte paletteLen (<= 255)]
// [paletteLen * 3 bytes RGB]
// [N bytes pixel indices]
//
// Encoded as base64url (no padding) for `#p=...`.
const VERSION = 1;

function hexToRgbBytes(hex) {
  const h = normalizeHex(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function bytesToHex(r, g, b) {
  const to2 = (x) => x.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function base64UrlEncode(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  const b64 = btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(payload) {
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payload.length + 3) % 4);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function encodeToUrlPayload(drawing) {
  const d = ensureDrawingShape(drawing);
  const palLen = clamp(d.palette.length, 1, 255);
  const bytes = new Uint8Array(2 + palLen * 3 + N);
  bytes[0] = VERSION;
  bytes[1] = palLen;
  let o = 2;
  for (let i = 0; i < palLen; i++) {
    const [r, g, b] = hexToRgbBytes(d.palette[i]);
    bytes[o++] = r; bytes[o++] = g; bytes[o++] = b;
  }
  for (let i = 0; i < N; i++) bytes[o++] = clamp(d.pixels[i] | 0, 0, palLen - 1);
  return base64UrlEncode(bytes);
}

export function decodeFromUrlPayload(payload) {
  const bytes = base64UrlDecodeToBytes(payload);
  if (bytes.length < 2) return makeBlankDrawing("#000000");
  const version = bytes[0];
  if (version !== VERSION) return makeBlankDrawing("#000000");
  const palLen = clamp(bytes[1], 1, 255);
  const needLen = 2 + palLen * 3 + N;
  if (bytes.length < needLen) return makeBlankDrawing("#000000");
  let o = 2;
  const palette = [];
  for (let i = 0; i < palLen; i++) {
    const r = bytes[o++], g = bytes[o++], b = bytes[o++];
    palette.push(bytesToHex(r, g, b));
  }
  const pixels = new Array(N);
  for (let i = 0; i < N; i++) pixels[i] = clamp(bytes[o++], 0, palLen - 1);
  return ensureDrawingShape({ w: W, h: H, palette, pixels });
}


