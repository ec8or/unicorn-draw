import { drawToCanvas } from "./render.js";
import { ensureDrawingShape } from "./codec.js";

const $ = (sel) => document.querySelector(sel);

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

async function fetchCurrentId() {
  try {
    const res = await fetch("/api/current", { cache: "no-store" });
    if (!res.ok) return null;
    const artwork = await res.json();
    return artwork.id;
  } catch {
    return null;
  }
}

async function fetchGallery() {
  try {
    const res = await fetch("/api/gallery", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load gallery");
    return await res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function fetchArtwork(id) {
  try {
    const res = await fetch(`/api/artwork/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load artwork");
    return await res.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}

function createThumbnail(drawing, size = 200) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  drawToCanvas(canvas, ensureDrawingShape(drawing));
  return canvas;
}

function renderGalleryItem(artwork, currentId) {
  const item = document.createElement("div");
  item.className = "gallery-item";
  item.setAttribute("data-id", artwork.id);
  if (artwork.id === currentId) {
    item.classList.add("now-playing");
  }

  const canvas = createThumbnail(artwork.drawing || {});
  item.appendChild(canvas);

  const info = document.createElement("div");
  info.className = "gallery-item-info";
  
  const artist = document.createElement("div");
  artist.className = "gallery-item-artist";
  artist.textContent = artwork.artist || "Anonymous";
  info.appendChild(artist);

  const date = document.createElement("div");
  date.className = "gallery-item-date";
  date.textContent = formatDate(artwork.created_at);
  info.appendChild(date);

  item.appendChild(info);

  if (artwork.id === currentId) {
    const badge = document.createElement("div");
    badge.className = "now-playing-badge";
    badge.textContent = "Now Playing";
    item.appendChild(badge);
  }

  item.addEventListener("click", () => {
    window.location.href = `/view.html?id=${artwork.id}`;
  });

  return item;
}

function updateCurrentIndicator(currentId) {
  // Remove "now-playing" from all items
  document.querySelectorAll(".gallery-item").forEach((item) => {
    item.classList.remove("now-playing");
    const badge = item.querySelector(".now-playing-badge");
    if (badge) badge.remove();
  });

  // Add "now-playing" to current item
  if (currentId) {
    const currentItem = document.querySelector(`[data-id="${currentId}"]`);
    if (currentItem) {
      currentItem.classList.add("now-playing");
      const badge = document.createElement("div");
      badge.className = "now-playing-badge";
      badge.textContent = "Now Playing";
      currentItem.appendChild(badge);
    }
  }
}

export async function initGallery() {
  const galleryEl = $("#gallery");
  if (!galleryEl) return;

  setStatus("Loading gallery…");

  // Fetch gallery and current artwork in parallel
  let currentId = await fetchCurrentId();
  const gallery = await fetchGallery();

  if (gallery.length === 0) {
    setStatus("No artworks yet. Be the first to submit!");
    return;
  }

  // Fetch full artwork data for each item (we need the drawing for thumbnails)
  const artworks = await Promise.all(
    gallery.map((item) => fetchArtwork(item.id))
  );

  galleryEl.innerHTML = "";
  artworks.forEach((artwork) => {
    if (!artwork) return;
    const item = renderGalleryItem(artwork, currentId);
    galleryEl.appendChild(item);
  });

  setStatus(`Loaded ${artworks.length} artwork${artworks.length !== 1 ? "s" : ""}`);

  // Poll for current artwork every 5 seconds
  setInterval(async () => {
    const newCurrentId = await fetchCurrentId();
    if (newCurrentId !== currentId) {
      currentId = newCurrentId;
      updateCurrentIndicator(currentId);
    }
  }, 5000);
}

