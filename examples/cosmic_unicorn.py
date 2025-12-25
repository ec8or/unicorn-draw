"""
unicorn-draw Micropython client for Cosmic Unicorn
Fetches the shared drawing from the server and displays it on a 32x32 LED matrix.
"""

import time
import json
from cosmic import CosmicUnicorn
from picographics import PicoGraphics, DISPLAY_COSMIC_UNICORN
import network
import urequests

# Configuration: Update with your server URL
SERVER_URL = "http://your-server.com"  # Change this to your deployed URL
API_ENDPOINT = f"{SERVER_URL}/api/latest"
FALLBACK_ENDPOINT = f"{SERVER_URL}/drawings/latest.json"

# Update interval (seconds)
UPDATE_INTERVAL = 2.0

# Cosmic Unicorn setup
cu = CosmicUnicorn()
gfx = PicoGraphics(display=DISPLAY_COSMIC_UNICORN)

WIDTH = 32
HEIGHT = 32


def hex_to_rgb(hex_color):
    """Convert hex color string (#rrggbb) to RGB tuple (r, g, b)."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) != 6:
        return (0, 0, 0)
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b)


def fetch_drawing():
    """Fetch the latest drawing from the server."""
    try:
        # Try /api/latest first
        response = urequests.get(API_ENDPOINT, timeout=5)
        if response.status_code == 200:
            return json.loads(response.text)
    except:
        pass
    
    try:
        # Fallback to /drawings/latest.json
        response = urequests.get(FALLBACK_ENDPOINT, timeout=5)
        if response.status_code == 200:
            return json.loads(response.text)
    except:
        pass
    
    return None


def display_drawing(drawing_data):
    """Display the drawing on the Cosmic Unicorn."""
    if not drawing_data:
        return False
    
    # Validate structure
    if 'w' not in drawing_data or 'h' not in drawing_data:
        return False
    if 'palette' not in drawing_data or 'pixels' not in drawing_data:
        return False
    
    w = drawing_data['w']
    h = drawing_data['h']
    palette = drawing_data['palette']
    pixels = drawing_data['pixels']
    
    # Ensure we have enough pixels
    if len(pixels) < w * h:
        return False
    
    # Convert palette to RGB tuples
    rgb_palette = []
    for hex_color in palette:
        rgb_palette.append(hex_to_rgb(hex_color))
    
    # Clear the display
    gfx.clear()
    
    # Draw each pixel
    for y in range(min(h, HEIGHT)):
        for x in range(min(w, WIDTH)):
            idx = y * w + x
            if idx < len(pixels):
                palette_idx = pixels[idx]
                if 0 <= palette_idx < len(rgb_palette):
                    r, g, b = rgb_palette[palette_idx]
                    pen = gfx.create_pen(r, g, b)
                    gfx.set_pen(pen)
                    gfx.pixel(x, y)
    
    # Update the display
    cu.update(gfx)
    return True


def main():
    """Main loop: fetch and display the drawing periodically."""
    print("unicorn-draw client starting...")
    print(f"Fetching from: {API_ENDPOINT}")
    
    last_drawing = None
    
    while True:
        try:
            drawing = fetch_drawing()
            if drawing:
                if display_drawing(drawing):
                    print("Drawing updated successfully")
                    last_drawing = drawing
                else:
                    print("Failed to display drawing (invalid format?)")
            else:
                print("No drawing available from server")
                # Optionally display last known drawing or a blank screen
                if last_drawing:
                    display_drawing(last_drawing)
        except Exception as e:
            print(f"Error: {e}")
            # On error, keep showing last known drawing if available
            if last_drawing:
                display_drawing(last_drawing)
        
        time.sleep(UPDATE_INTERVAL)


if __name__ == "__main__":
    main()

