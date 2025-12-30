# Gallery Display for Cosmic Unicorn
# Fetches artworks from the gallery API and displays them
# Press A button to manually cycle to next artwork

import time
import machine
import network
import urequests
from cosmic import CosmicUnicorn
from picographics import PicoGraphics, DISPLAY_COSMIC_UNICORN as DISPLAY

# Configuration - UPDATE THESE
SSID = "YOUR_WIFI_SSID"
PASSWORD = "YOUR_WIFI_PASSWORD"
API_URL = "http://your-server.com"  # Your server URL
API_SECRET = "06911ead4a05f7b5ee1ac68379a7e819aff8c7902edc6a441eaa84bea32ea90f"  # Or set via env

# Overclock to 200MHz for better performance
machine.freq(200000000)

# Initialize display FIRST (before network)
print("Initializing display...")
cosmic = CosmicUnicorn()
graphics = PicoGraphics(DISPLAY)
brightness = 0.5
cosmic.set_brightness(brightness)
print("Display ready")

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)

def pressed():
    """Returns the id of the button that is currently pressed or None if none are"""
    if cosmic.is_pressed(CosmicUnicorn.SWITCH_A):
        return CosmicUnicorn.SWITCH_A
    if cosmic.is_pressed(CosmicUnicorn.SWITCH_B):
        return CosmicUnicorn.SWITCH_B
    if cosmic.is_pressed(CosmicUnicorn.SWITCH_C):
        return CosmicUnicorn.SWITCH_C
    if cosmic.is_pressed(CosmicUnicorn.SWITCH_D):
        return CosmicUnicorn.SWITCH_D
    return None

def draw_artwork(data):
    """Draw artwork data to the display"""
    try:
        palette = data["palette"]
        pixels = data["pixels"]
        
        # Create pens for palette
        rgb_palette = [hex_to_rgb(c) for c in palette]
        pens = [graphics.create_pen(r, g, b) for r, g, b in rgb_palette]
        
        # Draw all pixels
        for y in range(32):
            for x in range(32):
                idx = pixels[y * 32 + x]
                if idx < len(pens):
                    graphics.set_pen(pens[idx])
                    graphics.pixel(x, y)
        
        cosmic.update(graphics)
        return True
    except Exception as e:
        print(f"Error drawing artwork: {e}")
        return False

def fetch_next_artwork():
    """Fetch next artwork from API"""
    try:
        url = f"{API_URL}/api/next?secret={API_SECRET}"
        print(f"Fetching: {url}")
        resp = urequests.get(url, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            resp.close()
            return data
        else:
            print(f"HTTP {resp.status_code}")
            resp.close()
            return None
    except Exception as e:
        print(f"Error fetching artwork: {e}")
        return None

def show_error():
    """Show error pattern on display"""
    graphics.set_pen(graphics.create_pen(255, 0, 0))
    graphics.clear()
    graphics.set_pen(graphics.create_pen(255, 255, 255))
    graphics.text("ERROR", 2, 12, -1, 1)
    cosmic.update(graphics)

# Connect to WiFi
print("Connecting to WiFi...")
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
if not wlan.isconnected():
    print(f"Connecting to {SSID}...")
    wlan.connect(SSID, PASSWORD)
    timeout = 0
    while not wlan.isconnected() and timeout < 20:
        time.sleep(0.5)
        timeout += 1
    
    if not wlan.isconnected():
        print("WiFi connection failed!")
        show_error()
        while True:
            time.sleep(1)
    
print(f"WiFi connected: {wlan.ifconfig()[0]}")

# Initial fetch
print("Fetching initial artwork...")
current_artwork = fetch_next_artwork()
if current_artwork and "drawing" in current_artwork:
    draw_artwork(current_artwork["drawing"])
    print(f"Displaying artwork by {current_artwork.get('artist', 'Unknown')}")
else:
    print("No artwork available")
    show_error()

# Main loop
sleep = False
was_sleep_pressed = False
last_auto_update = time.time()
auto_update_interval = 300  # Auto-update every 5 minutes (300 seconds)
button_pressed_time = 0

while True:
    # Check for button presses
    btn = pressed()
    
    # A button: manually cycle to next artwork
    if btn == CosmicUnicorn.SWITCH_A:
        if time.time() - button_pressed_time > 0.5:  # Debounce
            print("A button pressed - fetching next artwork...")
            next_artwork = fetch_next_artwork()
            if next_artwork and "drawing" in next_artwork:
                draw_artwork(next_artwork["drawing"])
                current_artwork = next_artwork
                print(f"Displaying artwork by {next_artwork.get('artist', 'Unknown')}")
                last_auto_update = time.time()  # Reset auto-update timer
            button_pressed_time = time.time()
    
    # B, C, D buttons: reset device
    if btn in (CosmicUnicorn.SWITCH_B, CosmicUnicorn.SWITCH_C, CosmicUnicorn.SWITCH_D):
        print("Reset button pressed")
        machine.reset()
    
    # Sleep button toggle
    sleep_pressed = cosmic.is_pressed(CosmicUnicorn.SWITCH_SLEEP)
    if sleep_pressed and not was_sleep_pressed:
        sleep = not sleep
        print(f"Sleep mode: {sleep}")
    was_sleep_pressed = sleep_pressed
    
    if sleep:
        # Fade out if screen not off
        current_brightness = cosmic.get_brightness()
        cosmic.set_brightness(max(0.0, current_brightness - 0.01))
        if cosmic.get_brightness() > 0.0:
            cosmic.update(graphics)
    else:
        # Brightness controls
        if cosmic.is_pressed(CosmicUnicorn.SWITCH_BRIGHTNESS_UP):
            brightness += 0.01
        if cosmic.is_pressed(CosmicUnicorn.SWITCH_BRIGHTNESS_DOWN):
            brightness -= 0.01
        brightness = max(min(brightness, 1.0), 0.0)
        cosmic.set_brightness(brightness)
        
        # Auto-update every N seconds
        if time.time() - last_auto_update >= auto_update_interval:
            print("Auto-updating artwork...")
            next_artwork = fetch_next_artwork()
            if next_artwork and "drawing" in next_artwork:
                draw_artwork(next_artwork["drawing"])
                current_artwork = next_artwork
                print(f"Displaying artwork by {next_artwork.get('artist', 'Unknown')}")
            last_auto_update = time.time()
        
        cosmic.update(graphics)
    
    # Small delay to prevent USB serial issues
    time.sleep(0.001)

