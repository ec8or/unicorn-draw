"""
unicorn-draw Micropython client for Cosmic Unicorn
Fetches the shared drawing from the server and displays it on a 32x32 LED matrix.

SETUP:
1. Connect to WiFi first:
   - Option A: Run wifi_setup.py once to connect
   - Option B: Add WiFi credentials below and uncomment the connect_wifi() call
   - Option C: Use your own WiFi connection method

2. Update SERVER_URL below with your deployed server URL
"""

import time
import json
from cosmic import CosmicUnicorn
from picographics import PicoGraphics, DISPLAY_COSMIC_UNICORN
import network
import urequests

# WiFi Configuration (uncomment and fill in if you want auto-connect)
# WIFI_SSID = "your-wifi-name"
# WIFI_PASSWORD = "your-wifi-password"

# Server Configuration: Update with your server URL
SERVER_URL = "http://gsw4sgc8o4o4s8w48k4k4ww8.34.89.5.121.sslip.io"  # Change this to your deployed URL
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


def check_wifi():
    """Check if WiFi is connected."""
    try:
        wlan = network.WLAN(network.STA_IF)
        if wlan.isconnected():
            print(f"WiFi connected: {wlan.ifconfig()[0]}")
            return True
        else:
            print("WiFi not connected!")
            return False
    except:
        print("Could not check WiFi status")
        return False


def interpret_error(err):
    """Interpret common urequests error codes."""
    err_str = str(err)
    if "-6" in err_str or "6" in err_str:
        return "DNS/Network error (-6): Check WiFi connection and DNS"
    elif "-2" in err_str or "2" in err_str:
        return "Network unreachable (-2): Check WiFi connection"
    elif "-110" in err_str or "110" in err_str:
        return "Connection timeout (-110): Server may be unreachable"
    else:
        return f"Network error: {err}"


def fetch_drawing():
    """Fetch the latest drawing from the server."""
    # Check WiFi first
    if not check_wifi():
        print("WiFi not connected - cannot fetch drawing")
        return None
    
    # Try /api/latest first
    try:
        response = urequests.get(API_ENDPOINT, timeout=10)
        print(f"GET {API_ENDPOINT} -> {response.status_code}")
        
        if response.status_code == 200:
            data = json.loads(response.text)
            # Validate it's actually a drawing, not an error message
            if isinstance(data, dict) and 'pixels' in data and 'palette' in data:
                response.close()
                return data
            else:
                print(f"Response is not a drawing: {data}")
        elif response.status_code == 404:
            print("No drawing saved yet (404)")
        else:
            print(f"Unexpected status: {response.status_code}")
            print(f"Response: {response.text[:100]}")
        response.close()
    except OSError as e:
        print(f"Network error fetching from API: {interpret_error(e)}")
    except Exception as e:
        print(f"Error fetching from API: {e}")
    
    # Fallback to /drawings/latest.json
    try:
        response = urequests.get(FALLBACK_ENDPOINT, timeout=10)
        print(f"GET {FALLBACK_ENDPOINT} -> {response.status_code}")
        
        if response.status_code == 200:
            data = json.loads(response.text)
            if isinstance(data, dict) and 'pixels' in data and 'palette' in data:
                response.close()
                return data
            else:
                print(f"Fallback response is not a drawing: {data}")
        response.close()
    except OSError as e:
        print(f"Network error fetching from fallback: {interpret_error(e)}")
    except Exception as e:
        print(f"Error fetching from fallback: {e}")
    
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


def connect_wifi_simple(ssid, password, timeout=30):
    """Simple WiFi connection helper."""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if wlan.isconnected():
        print(f"Already connected: {wlan.ifconfig()[0]}")
        return True
    
    print(f"Connecting to {ssid}...")
    wlan.connect(ssid, password)
    
    start_time = time.time()
    while not wlan.isconnected() and (time.time() - start_time) < timeout:
        print(".", end="")
        time.sleep(1)
    
    if wlan.isconnected():
        print(f"\nConnected! IP: {wlan.ifconfig()[0]}")
        return True
    else:
        print(f"\nFailed to connect")
        return False


def main():
    """Main loop: fetch and display the drawing periodically."""
    print("unicorn-draw client starting...")
    print(f"Fetching from: {API_ENDPOINT}")
    
    # Optional: Auto-connect to WiFi (uncomment and fill in credentials above)
    # if not check_wifi():
    #     if 'WIFI_SSID' in globals() and 'WIFI_PASSWORD' in globals():
    #         connect_wifi_simple(WIFI_SSID, WIFI_PASSWORD)
    
    # Check WiFi on startup
    if not check_wifi():
        print("WARNING: WiFi not connected. Please connect to WiFi first.")
        print("Run wifi_setup.py or connect manually before running this script.")
        print("The script will continue but network requests will fail.")
    
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
                print("No drawing available from server (save a drawing via the web UI first)")
                # Optionally display last known drawing or a blank screen
                if last_drawing:
                    display_drawing(last_drawing)
                else:
                    # Show a blank/black screen if no drawing has ever been loaded
                    gfx.clear()
                    cu.update(gfx)
        except Exception as e:
            print(f"Error: {e}")
            # On error, keep showing last known drawing if available
            if last_drawing:
                display_drawing(last_drawing)
        
        time.sleep(UPDATE_INTERVAL)


if __name__ == "__main__":
    main()

