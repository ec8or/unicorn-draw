// 64 vibrant LED-friendly colors for pixel art
// Based on RGB color values optimized for LED displays

export function generatePalette() {
  const colors = [];

  // Pure primaries and essentials
  colors.push("#000000"); // Black
  colors.push("#ffffff"); // White
  colors.push("#ff0000"); // Red
  colors.push("#00ff00"); // Green
  colors.push("#0000ff"); // Blue
  colors.push("#ffff00"); // Yellow
  colors.push("#ff00ff"); // Magenta
  colors.push("#00ffff"); // Cyan

  // Vibrant blues (from RGB guide)
  colors.push("#1e90ff"); // Dodger Blue (30-144-255)
  colors.push("#00bfff"); // Deep Sky Blue (0-191-255)
  colors.push("#4169e1"); // Royal Blue (65-105-225)
  colors.push("#0000cd"); // Medium Blue (0-0-205)
  colors.push("#000080"); // Navy (0-0-128)
  colors.push("#191970"); // Midnight Blue (25-25-112)
  colors.push("#00ced1"); // Dark Turquoise (0-206-209)
  colors.push("#48d1cc"); // Medium Turquoise (72-209-204)
  colors.push("#87ceeb"); // Sky Blue (135-206-235)
  colors.push("#4682b4"); // Steel Blue (70-130-180)

  // Vibrant greens
  colors.push("#00ff7f"); // Spring Green (0-255-127)
  colors.push("#32cd32"); // Lime Green (50-205-50)
  colors.push("#7cfc00"); // Lawn Green (124-252-0)
  colors.push("#00fa9a"); // Medium Spring Green (0-250-154)
  colors.push("#228b22"); // Forest Green (34-139-34)
  colors.push("#2e8b57"); // Sea Green (46-139-87)
  colors.push("#3cb371"); // Medium Sea Green (60-179-113)
  colors.push("#66cdaa"); // Medium Aquamarine (102-205-170)
  colors.push("#7fffd4"); // Aquamarine (127-255-212)

  // Vibrant yellows/oranges
  colors.push("#ffd700"); // Gold (255-215-0)
  colors.push("#ffa500"); // Orange (255-165-0)
  colors.push("#ff8c00"); // Dark Orange (255-140-0)
  colors.push("#ff4500"); // Orange Red (255-69-0)
  colors.push("#ff6347"); // Tomato (255-99-71)
  colors.push("#ff7f50"); // Coral (255-127-80)
  colors.push("#ffa07a"); // Light Salmon (255-160-122)
  colors.push("#ffdab9"); // Peach Puff (255-218-185)

  // Vibrant pinks/reds
  colors.push("#ff69b4"); // Hot Pink (255-105-180)
  colors.push("#ff1493"); // Deep Pink (255-20-147)
  colors.push("#dc143c"); // Crimson (220-20-60)
  colors.push("#b22222"); // Firebrick (178-34-34)
  colors.push("#8b0000"); // Dark Red (139-0-0)
  colors.push("#ffc0cb"); // Pink (255-192-203)
  colors.push("#ffb6c1"); // Light Pink (255-182-193)
  colors.push("#ff69b4"); // Hot Pink (duplicate, will be removed)

  // Vibrant purples/violets
  colors.push("#8a2be2"); // Blue Violet (138-43-226)
  colors.push("#9400d3"); // Violet (148-0-211)
  colors.push("#9932cc"); // Dark Orchid (153-50-204)
  colors.push("#ba55d3"); // Medium Orchid (186-85-211)
  colors.push("#da70d6"); // Orchid (218-112-214)
  colors.push("#ee82ee"); // Violet (238-130-238)
  colors.push("#dda0dd"); // Plum (221-160-221)
  colors.push("#9370db"); // Medium Purple (147-112-219)
  colors.push("#7b68ee"); // Medium Slate Blue (123-104-238)

  // Grayscale ramp (8 steps for smooth gradients)
  colors.push("#2a2a2a"); // Dark gray
  colors.push("#555555"); // Medium gray
  colors.push("#808080"); // Gray
  colors.push("#aaaaaa"); // Light gray
  colors.push("#d5d5d5"); // Very light gray

  // Remove duplicates and ensure exactly 64
  const unique = Array.from(new Set(colors));
  
  // If we have less than 64, add some intermediate vibrant colors
  while (unique.length < 64) {
    // Add some vibrant intermediate colors
    const extras = [
      "#ff0080", "#ff4000", "#ff8000", "#ffc000",
      "#80ff00", "#40ff00", "#00ff40", "#00ff80",
      "#00ffc0", "#00ffff", "#0080ff", "#0040ff",
      "#4000ff", "#8000ff", "#c000ff", "#ff00ff",
      "#ff0080", "#ff0040", "#ff4000", "#ff8000"
    ];
    for (const c of extras) {
      if (!unique.includes(c) && unique.length < 64) {
        unique.push(c);
      }
    }
    if (unique.length >= 64) break;
  }
  
  return unique.slice(0, 64);
}

export const PALETTE_COLORS = generatePalette();
