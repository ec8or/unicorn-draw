import {
  W,
  H,
  N,
  makeBlankDrawing,
  paletteIndexForColor,
  encodeToUrlPayload,
  decodeFromUrlPayload,
  ensureDrawingShape,
} from "./codec.js";
import { drawToCanvas, getCellFromPointer } from "./render.js";

const $ = (sel) => document.querySelector(sel);

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
}

function nowIsoStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function download(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function drawingToJson(d) {
  return JSON.stringify(ensureDrawingShape(d), null, 2);
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function setOut(value) {
  const out = $("#out");
  if (out) out.value = value;
}

function setShareLink(url) {
  const el = $("#shareLink");
  if (el) {
    el.href = url;
    el.textContent = url;
  }
}

function setLatestLink(url) {
  const el = $("#latestLink");
  if (el) {
    el.href = url;
    el.textContent = url;
  }
}

function loadFromHashIfPresent() {
  const hash = location.hash || "";
  const m = hash.match(/#p=([^&]+)/);
  if (!m) return null;
  try {
    return decodeFromUrlPayload(m[1]);
  } catch {
    return null;
  }
}

export function initEditor() {
  const canvas = $("#c");
  const color = $("#color");
  const btnClear = $("#clear");
  const btnFill = $("#fill");
  const btnExport = $("#export");
  const btnCopy = $("#copyLink");
  const btnLoad = $("#load");
  const btnSave = $("#save");
  const btnImport = $("#import");
  const fileInput = $("#file");

  let drawing = loadFromHashIfPresent() || makeBlankDrawing("#000000");
  let isDown = false;
  let lastIdx = -1;

  function render() {
    drawToCanvas(canvas, drawing);
    const payload = encodeToUrlPayload(drawing);
    const url = new URL(location.href);
    url.pathname = url.pathname.replace(/\/[^/]*$/, "/read.html");
    url.hash = `p=${payload}`;
    setShareLink(url.toString());
    setOut(payload);

    const latestUrl = new URL(location.href);
    latestUrl.pathname = latestUrl.pathname.replace(/\/[^/]*$/, "/read.html");
    latestUrl.search = "?src=/api/latest";
    latestUrl.hash = "";
    setLatestLink(latestUrl.toString());
  }

  function paintAt(idx, hex) {
    const palIdx = paletteIndexForColor(drawing, hex);
    drawing.pixels[idx] = palIdx;
  }

  function pointerPaint(ev) {
    const cell = getCellFromPointer(canvas, ev.clientX, ev.clientY);
    if (!cell) return;
    if (cell.idx === lastIdx) return;
    lastIdx = cell.idx;
    paintAt(cell.idx, color.value);
    drawToCanvas(canvas, drawing);
  }

  canvas.addEventListener("pointerdown", (ev) => {
    isDown = true;
    canvas.setPointerCapture(ev.pointerId);
    lastIdx = -1;
    pointerPaint(ev);
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!isDown) return;
    pointerPaint(ev);
  });
  canvas.addEventListener("pointerup", () => {
    isDown = false;
    lastIdx = -1;
    render(); // update share link on release
  });
  canvas.addEventListener("pointercancel", () => {
    isDown = false;
    lastIdx = -1;
    render();
  });

  btnClear?.addEventListener("click", () => {
    drawing = makeBlankDrawing("#000000");
    render();
    setStatus("Cleared.");
  });

  btnFill?.addEventListener("click", () => {
    const palIdx = paletteIndexForColor(drawing, color.value);
    drawing.pixels = new Array(N).fill(palIdx);
    render();
    setStatus("Filled.");
  });

  btnExport?.addEventListener("click", () => {
    download(`unicorn-draw-${nowIsoStamp()}.json`, drawingToJson(drawing));
    setStatus("Downloaded JSON.");
  });

  btnCopy?.addEventListener("click", async () => {
    const a = $("#shareLink");
    const url = a?.href || "";
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Share link copied.");
    } catch {
      setStatus("Could not copy automatically; select the link and copy manually.");
    }
  });

  btnLoad?.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/latest", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) {
          setStatus("No shared drawing found yet.");
          return;
        }
        setStatus("Load failed (API not available?).");
        return;
      }
      const json = await res.json();
      drawing = ensureDrawingShape(json);
      render();
      setStatus("Loaded shared latest.");
    } catch (e) {
      setStatus("Load failed (API not available?).");
      console.error(e);
    }
  });

  btnSave?.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/latest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: drawingToJson(drawing),
      });
      if (!res.ok) {
        setStatus("Save failed (API not available?).");
        return;
      }
      setStatus("Saved as shared latest.");
    } catch (e) {
      setStatus("Save failed (API not available?).");
      console.error(e);
    }
  });

  btnImport?.addEventListener("click", () => fileInput?.click());

  fileInput?.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const text = await f.text();
    const parsed = safeParseJson(text);
    drawing = ensureDrawingShape(parsed);
    render();
    setStatus("Imported JSON.");
    fileInput.value = "";
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
      ev.preventDefault();
      color?.focus();
    }
  });

  render();
  setStatus(`Ready. ${W}×${H}. Drag to draw.`);
}


