# Gallery Display for Cosmic Unicorn
# Fetches artworks from the gallery API and displays them
# Press A button to manually cycle to next artwork

import time
import machine
import network
import urequests
from cosmic import CosmicUnicorn
from picographics import PicoGraphics, DISPLAY_COSMIC_UNICORN as DISPLAY

# Try to import audio (optional - may not be available)
try:
    from audio import WavPlayer
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False
    WavPlayer = None

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

# Initialize audio player (if available)
# GPIO pins: left=0, right=10, data=11, clock=9, amp_enable=22
sound = None
if AUDIO_AVAILABLE:
    try:
        sound = WavPlayer(0, 10, 11, 9, amp_enable=22)
        print("Audio initialized")
    except Exception as e:
        print(f"Audio initialization failed: {e}")
        sound = None
else:
    print("Audio module not available - sound disabled")

def play_cheer():
    """Play the cheer sound effect"""
    if AUDIO_AVAILABLE and sound:
        try:
            sound.play_wav("cheer.wav", False)
            # Don't block - let it play in background
        except Exception as e:
            print(f"Error playing sound: {e}")

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
    play_cheer()
    print(f"Displaying artwork by {current_artwork.get('artist', 'Unknown')}")
else:
    print("No artwork available")
    show_error()

# Main loop
sleep = False
was_sleep_pressed = False
was_a_pressed = False
was_b_pressed = False
was_c_pressed = False
was_d_pressed = False
last_auto_update = time.time()
auto_update_interval = 300  # Auto-update every 5 minutes (300 seconds)

while True:
    # Check for button presses with edge detection
    btn = pressed()
    a_pressed = (btn == CosmicUnicorn.SWITCH_A)
    b_pressed = (btn == CosmicUnicorn.SWITCH_B)
    c_pressed = (btn == CosmicUnicorn.SWITCH_C)
    d_pressed = (btn == CosmicUnicorn.SWITCH_D)
    
    # A button: manually cycle to next artwork (only on press, not while held)
    if a_pressed and not was_a_pressed:
        print("A button pressed - fetching next artwork...")
        next_artwork = fetch_next_artwork()
        if next_artwork and "drawing" in next_artwork:
            draw_artwork(next_artwork["drawing"])
            play_cheer()
            current_artwork = next_artwork
            print(f"Displaying artwork by {next_artwork.get('artist', 'Unknown')}")
            last_auto_update = time.time()  # Reset auto-update timer
    was_a_pressed = a_pressed
    
    # B, C, D buttons: reset device (only on press, not while held)
    if (b_pressed and not was_b_pressed) or (c_pressed and not was_c_pressed) or (d_pressed and not was_d_pressed):
        print("Reset button pressed")
        machine.reset()
    was_b_pressed = b_pressed
    was_c_pressed = c_pressed
    was_d_pressed = d_pressed
    
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
                play_cheer()
                current_artwork = next_artwork
                print(f"Displaying artwork by {next_artwork.get('artist', 'Unknown')}")
            last_auto_update = time.time()
        
        cosmic.update(graphics)
    
    # Small delay to prevent USB serial issues
    time.sleep(0.001)

