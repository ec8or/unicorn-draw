import { decodeFromUrlPayload, ensureDrawingShape, makeBlankDrawing } from "./codec.js";
import { drawToCanvas } from "./render.js";

const $ = (sel) => document.querySelector(sel);

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
}

function getHashPayload() {
  const hash = location.hash || "";
  const m = hash.match(/#p=([^&]+)/);
  return m ? m[1] : null;
}

function getQueryParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

async function fetchJson(src) {
  const res = await fetch(src, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function initViewer() {
  const canvas = $("#c");
  const payload = getHashPayload();
  const src = getQueryParam("src");

  try {
    if (payload) {
      const d = decodeFromUrlPayload(payload);
      drawToCanvas(canvas, d);
      setStatus("Rendered from URL payload.");
      return;
    }
    if (src) {
      const json = await fetchJson(src);
      const d = ensureDrawingShape(json);
      drawToCanvas(canvas, d);
      setStatus(`Rendered from JSON: ${src}`);
      return;
    }
    // Convenience: try shared latest if the API exists.
    try {
      const json = await fetchJson("/api/latest");
      const d = ensureDrawingShape(json);
      drawToCanvas(canvas, d);
      setStatus("Rendered shared latest (/api/latest).");
      return;
    } catch {
      // ignore
    }
    drawToCanvas(canvas, makeBlankDrawing("#000000"));
    setStatus("No payload. Use #p=... or ?src=/api/latest (or /drawings/latest.json).");
  } catch (e) {
    drawToCanvas(canvas, makeBlankDrawing("#000000"));
    setStatus(`Error loading drawing.`);
    console.error(e);
  }
}


