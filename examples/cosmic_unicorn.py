# Init display FIRST, then fetch and draw

import network
import urequests
import time

from cosmic import CosmicUnicorn
from picographics import PicoGraphics, DISPLAY_COSMIC_UNICORN

SSID = "DIGITALHIPPIE_2"
PASSWORD = "legopizza"
URL = "http://gsw4sgc8o4o4s8w48k4k4ww8.34.89.5.121.sslip.io/api/latest"

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)

# Step 1: Init display FIRST (before any network)
print("Initializing display...")
cu = CosmicUnicorn()
gfx = PicoGraphics(display=DISPLAY_COSMIC_UNICORN)
cu.set_brightness(0.5)
print("Display ready")

# Step 2: Connect to WiFi
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
if not wlan.isconnected():
    print("Connecting to WiFi:", SSID)
    wlan.connect(SSID, PASSWORD)
    while not wlan.isconnected():
        time.sleep(0.2)
print("WiFi connected")

# Step 3: Poll loop
while True:
    try:
        resp = urequests.get(URL)
        if resp.status_code == 200:
            data = resp.json()
            resp.close()
            
            palette = data["palette"]
            pixels = data["pixels"]
            
            # Create pens for palette
            rgb_palette = [hex_to_rgb(c) for c in palette]
            pens = [gfx.create_pen(red, green, blue) for red, green, blue in rgb_palette]
            
            # Draw all pixels
            for y in range(32):
                for x in range(32):
                    gfx.set_pen(pens[pixels[y * 32 + x]])
                    gfx.pixel(x, y)
            
            cu.update(gfx)
            print("Updated")
        else:
            print(f"HTTP {resp.status_code}")
            resp.close()
    except Exception as e:
        print(f"Error: {e}")
    
    time.sleep(2)
