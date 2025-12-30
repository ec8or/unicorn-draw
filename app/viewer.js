import { ensureDrawingShape, makeBlankDrawing } from "./codec.js";
import { drawToCanvas } from "./render.js";

const $ = (sel) => document.querySelector(sel);

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
}

function getQueryParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function fetchArtwork(id) {
  const res = await fetch(`/api/artwork/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function renderArtworkInfo(artwork) {
  const infoEl = $("#artwork-info");
  if (!infoEl) return;

  // Use textContent to prevent XSS
  const artistDiv = document.createElement("div");
  artistDiv.style.cssText = "font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 4px;";
  artistDiv.textContent = artwork.artist || "Anonymous";
  
  const dateDiv = document.createElement("div");
  dateDiv.style.cssText = "font-size: 12px; color: var(--muted);";
  dateDiv.textContent = formatDate(artwork.created_at);
  
  const container = document.createElement("div");
  container.style.cssText = "margin-bottom: 12px;";
  container.appendChild(artistDiv);
  container.appendChild(dateDiv);
  
  infoEl.innerHTML = "";
  infoEl.appendChild(container);
}

export async function initViewer() {
  const canvas = $("#c");
  const id = getQueryParam("id");

  try {
    if (id) {
      const artwork = await fetchArtwork(id);
      const d = ensureDrawingShape(artwork.drawing);
      drawToCanvas(canvas, d);
      renderArtworkInfo(artwork);
      setStatus("Artwork loaded.");
      return;
    }
    drawToCanvas(canvas, makeBlankDrawing("#000000"));
    setStatus("No artwork ID provided. Use ?id=...");
  } catch (e) {
    drawToCanvas(canvas, makeBlankDrawing("#000000"));
    setStatus("Error loading artwork.");
    console.error(e);
  }
}
