import {
  W,
  H,
  N,
  makeBlankDrawing,
  paletteIndexForColor,
  ensureDrawingShape,
} from "./codec.js";
import { drawToCanvas, getCellFromPointer } from "./render.js";
import { PALETTE_COLORS } from "./palette.js";

const $ = (sel) => document.querySelector(sel);

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
}

// Deep clone a drawing object
function cloneDrawing(drawing) {
  return {
    w: drawing.w,
    h: drawing.h,
    palette: [...drawing.palette],
    pixels: [...drawing.pixels],
  };
}

export function initEditor() {
  const canvas = $("#c");
  const paletteEl = $("#palette");
  const btnDraw = $("#draw");
  const btnClear = $("#clear");
  const btnFill = $("#fill");
  const btnUndo = $("#undo");
  const btnRedo = $("#redo");
  const btnSubmit = $("#submit");
  const artistInput = $("#artist");

  let drawing = makeBlankDrawing("#000000");
  let selectedColor = "#ffffff";
  let isDown = false;
  let lastIdx = -1;
  let fillMode = false;

  // Undo/redo history
  let history = [cloneDrawing(drawing)];
  let historyIndex = 0;
  let hasPaintedInStroke = false;
  let savedBeforeStroke = false;

  // Track if drawing has been modified
  function isDrawingBlank(d) {
    // Check if all pixels are the same (likely blank/cleared)
    const firstPixel = d.pixels[0];
    return d.pixels.every(p => p === firstPixel) && firstPixel === 0;
  }

  function hasUnsavedChanges() {
    return !isDrawingBlank(drawing);
  }

  // Render palette
  function renderPalette() {
    if (!paletteEl) return;
    paletteEl.innerHTML = "";
    PALETTE_COLORS.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.className = "palette-swatch";
      if (color === selectedColor) {
        swatch.classList.add("selected");
      }
      swatch.style.backgroundColor = color;
      swatch.setAttribute("aria-label", `Select color ${color}`);
      swatch.addEventListener("click", () => {
        selectedColor = color;
        renderPalette();
      });
      paletteEl.appendChild(swatch);
    });
  }

  function render() {
    drawToCanvas(canvas, drawing);
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    if (btnUndo) {
      btnUndo.disabled = historyIndex <= 0;
      btnUndo.style.opacity = historyIndex <= 0 ? "0.5" : "1";
    }
    if (btnRedo) {
      btnRedo.disabled = historyIndex >= history.length - 1;
      btnRedo.style.opacity = historyIndex >= history.length - 1 ? "0.5" : "1";
    }
  }

  function saveHistoryState() {
    // Don't save if this state is the same as the current history state
    const currentState = history[historyIndex];
    if (currentState && 
        currentState.palette.length === drawing.palette.length &&
        currentState.pixels.every((p, i) => p === drawing.pixels[i]) &&
        currentState.palette.every((p, i) => p === drawing.palette[i])) {
      return; // State hasn't changed, don't save
    }
    
    // Remove any future history if we're not at the end
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    // Add new state
    history.push(cloneDrawing(drawing));
    historyIndex = history.length - 1;
    // Limit history to 50 states to prevent memory issues
    if (history.length > 50) {
      history.shift();
      historyIndex--;
    }
    updateUndoRedoButtons();
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      drawing = cloneDrawing(history[historyIndex]);
      render();
      setStatus("Undone.");
    }
  }

  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      drawing = cloneDrawing(history[historyIndex]);
      render();
      setStatus("Redone.");
    }
  }

  function paintAt(idx, hex) {
    const palIdx = paletteIndexForColor(drawing, hex);
    drawing.pixels[idx] = palIdx;
  }

  function floodFill(startIdx, targetColorHex) {
    const targetPalIdx = paletteIndexForColor(drawing, targetColorHex);
    const startPalIdx = drawing.pixels[startIdx];
    
    // If already the target color, do nothing
    if (startPalIdx === targetPalIdx) return;
    
    // 4-directional neighbors: up, down, left, right (diagonals act as barriers)
    const neighbors = [
      -W,      // up
      W,       // down
      -1,      // left
      1,       // right
    ];
    
    const queue = [startIdx];
    const visited = new Set([startIdx]);
    
    while (queue.length > 0) {
      const idx = queue.shift();
      drawing.pixels[idx] = targetPalIdx;
      
      const x = idx % W;
      const y = Math.floor(idx / W);
      
      for (const offset of neighbors) {
        const newIdx = idx + offset;
        
        // Check bounds
        const newX = newIdx % W;
        const newY = Math.floor(newIdx / W);
        if (newX < 0 || newX >= W || newY < 0 || newY >= H) continue;
        
        // Check if already visited
        if (visited.has(newIdx)) continue;
        
        // Check if same color as starting pixel
        if (drawing.pixels[newIdx] === startPalIdx) {
          visited.add(newIdx);
          queue.push(newIdx);
        }
      }
    }
  }

  function pointerPaint(ev) {
    ev.preventDefault(); // Prevent default touch behavior
    const cell = getCellFromPointer(canvas, ev.clientX, ev.clientY);
    if (!cell) return;
    
    // If in fill mode, do flood fill and exit fill mode
    if (fillMode) {
      saveHistoryState();
      floodFill(cell.idx, selectedColor);
      render();
      fillMode = false;
      btnFill?.classList.remove("active");
      btnDraw?.classList.add("active");
      setStatus("Filled.");
      return;
    }
    
    if (cell.idx === lastIdx) return;
    
    // Save state before first paint of this stroke
    if (!hasPaintedInStroke) {
      saveHistoryState();
    }
    
    lastIdx = cell.idx;
    paintAt(cell.idx, selectedColor);
    hasPaintedInStroke = true;
    render();
  }

  // Tablet-friendly touch handling
  canvas.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    
    // If in fill mode, just do the fill and don't start painting
    if (fillMode) {
      pointerPaint(ev);
      return;
    }
    
    isDown = true;
    hasPaintedInStroke = false;
    canvas.setPointerCapture(ev.pointerId);
    lastIdx = -1;
    pointerPaint(ev);
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!isDown || fillMode) return;
    ev.preventDefault();
    pointerPaint(ev);
  });

  canvas.addEventListener("pointerup", (ev) => {
    ev.preventDefault();
    isDown = false;
    lastIdx = -1;
    
    // Save state after finishing paint stroke (if we actually painted)
    if (hasPaintedInStroke) {
      saveHistoryState();
    }
    
    // Reset flags for next stroke
    hasPaintedInStroke = false;
  });

  canvas.addEventListener("pointercancel", (ev) => {
    ev.preventDefault();
    isDown = false;
    lastIdx = -1;
    
    // Save state after finishing paint stroke (if we actually painted)
    if (hasPaintedInStroke) {
      saveHistoryState();
    }
    
    // Reset flags for next stroke
    hasPaintedInStroke = false;
  });

  // Prevent context menu on long press
  canvas.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
  });

  btnUndo?.addEventListener("click", () => {
    undo();
  });

  btnRedo?.addEventListener("click", () => {
    redo();
  });

  btnDraw?.addEventListener("click", () => {
    fillMode = false;
    btnDraw?.classList.add("active");
    btnFill?.classList.remove("active");
    setStatus("Draw mode: Drag to draw.");
  });

  btnFill?.addEventListener("click", () => {
    fillMode = !fillMode;
    if (fillMode) {
      btnFill?.classList.add("active");
      btnDraw?.classList.remove("active");
      setStatus("Fill mode: Click on canvas to fill area.");
    } else {
      btnFill?.classList.remove("active");
      btnDraw?.classList.add("active");
      setStatus("Draw mode: Drag to draw.");
    }
  });

  btnClear?.addEventListener("click", () => {
    saveHistoryState();
    drawing = makeBlankDrawing(selectedColor);
    saveHistoryState();
    render();
    setStatus("Cleared.");
  });

  btnSubmit?.addEventListener("click", async () => {
    const artist = artistInput?.value?.trim();
    if (!artist || artist.length === 0) {
      setStatus("Please enter your name.");
      artistInput?.focus();
      return;
    }

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist,
          drawing: ensureDrawingShape(drawing),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown error" }));
        setStatus(`Submit failed: ${err.error || "unknown error"}`);
        return;
      }

      const result = await res.json();
      setStatus("Artwork submitted! View it in the gallery.");
      // Reset canvas
      drawing = makeBlankDrawing("#000000");
      history = [cloneDrawing(drawing)];
      historyIndex = 0;
      render();
      artistInput.value = "";
      
      // Optionally redirect to gallery after a short delay
      setTimeout(() => {
        if (confirm("Artwork submitted! Would you like to view the gallery?")) {
          window.location.href = "/gallery.html";
        }
      }, 1000);
    } catch (e) {
      setStatus("Submit failed. Please try again.");
      console.error(e);
    }
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "z" && !ev.shiftKey) {
      ev.preventDefault();
      undo();
    } else if ((ev.ctrlKey || ev.metaKey) && (ev.key === "y" || (ev.key === "z" && ev.shiftKey))) {
      ev.preventDefault();
      redo();
    }
  });

  renderPalette();
  render();
  setStatus(`Ready. ${W}×${H}. Drag to draw.`);
  
  // Warn before leaving if there are unsaved changes
  window.addEventListener("beforeunload", (ev) => {
    if (hasUnsavedChanges()) {
      ev.preventDefault();
      ev.returnValue = "";
      return "";
    }
  });

  // Intercept navigation links
  document.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener("click", (ev) => {
      if (hasUnsavedChanges()) {
        if (!confirm("You have unsaved changes. Are you sure you want to leave?")) {
          ev.preventDefault();
          return false;
        }
      }
    });
  });
  
  // Initialize Lucide icons after everything is set up
  setTimeout(() => {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }, 0);
}
