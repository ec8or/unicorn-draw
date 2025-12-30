import { W, H, N, ensureDrawingShape } from "./codec.js";

// Each logical pixel is 3×3 physical pixels with 1px spacing
// Canvas size: 32 × 3 + 31 × 1 = 96 + 31 = 127
const PIXEL_SIZE = 3;
const GAP_SIZE = 1;
const PHYSICAL_W = W * PIXEL_SIZE + (W - 1) * GAP_SIZE; // 127
const PHYSICAL_H = H * PIXEL_SIZE + (H - 1) * GAP_SIZE; // 127

export function drawToCanvas(canvas, drawing) {
  const d = ensureDrawingShape(drawing);
  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = PHYSICAL_W;
  canvas.height = PHYSICAL_H;

  // Clear canvas with black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, PHYSICAL_W, PHYSICAL_H);

  // Draw each logical pixel as a 3×3 block with 1px spacing
  for (let i = 0; i < N; i++) {
    const logicalX = i % W;
    const logicalY = Math.floor(i / W);
    const palIdx = d.pixels[i] | 0;
    const hex = d.palette[palIdx] || d.palette[0] || "#000000";
    
    // Calculate physical position: each pixel takes 3px + 1px gap (except last)
    const physicalX = logicalX * (PIXEL_SIZE + GAP_SIZE);
    const physicalY = logicalY * (PIXEL_SIZE + GAP_SIZE);
    
    // Draw 3×3 block
    ctx.fillStyle = hex;
    ctx.fillRect(physicalX, physicalY, PIXEL_SIZE, PIXEL_SIZE);
  }
}

export function getCellFromPointer(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  // Map screen coordinates to physical canvas coordinates (127×127)
  const x = ((clientX - rect.left) / rect.width) * PHYSICAL_W;
  const y = ((clientY - rect.top) / rect.height) * PHYSICAL_H;
  
  // Convert physical coordinates to logical 32×32 grid
  // Each logical pixel is 3px + 1px gap = 4px spacing
  const cx = Math.floor(x / (PIXEL_SIZE + GAP_SIZE));
  const cy = Math.floor(y / (PIXEL_SIZE + GAP_SIZE));
  
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return null;
  return { x: cx, y: cy, idx: cy * W + cx };
}


