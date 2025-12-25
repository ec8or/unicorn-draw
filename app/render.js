import { W, H, N, ensureDrawingShape } from "./codec.js";

export function drawToCanvas(canvas, drawing) {
  const d = ensureDrawingShape(drawing);
  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = W;
  canvas.height = H;

  // Paint pixels at native res.
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < N; i++) {
    const palIdx = d.pixels[i] | 0;
    const hex = d.palette[palIdx] || d.palette[0] || "#000000";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const p = i * 4;
    img.data[p + 0] = r;
    img.data[p + 1] = g;
    img.data[p + 2] = b;
    img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function getCellFromPointer(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const cx = Math.floor(x * W);
  const cy = Math.floor(y * H);
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return null;
  return { x: cx, y: cy, idx: cy * W + cx };
}


