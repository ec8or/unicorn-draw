# Gallery Display for Cosmic Unicorn
# Fetches artworks from the gallery API and displays them
# Press A button to manually cycle to next artwork

import time
import machine
import network
import urequests
import gc
from cosmic import CosmicUnicorn
from picographics import PicoGraphics, DISPLAY_COSMIC_UNICORN as DISPLAY

# Try to import audio (optional - may not be available)
try:
    from audio import WavPlayer
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False
    WavPlayer = None

# Import configuration from config.py
try:
    from config import SSID, PASSWORD, API_URL, API_SECRET, REQUEST_TIMEOUT, WIFI_CONNECT_TIMEOUT, AUTO_UPDATE_INTERVAL
except ImportError:
    # Fallback defaults if config.py doesn't exist
    SSID = "YOUR_WIFI_SSID"
    PASSWORD = "YOUR_WIFI_PASSWORD"
    API_URL = "http://your-server.com"
    API_SECRET = "06911ead4a05f7b5ee1ac68379a7e819aff8c7902edc6a441eaa84bea32ea90f"
    REQUEST_TIMEOUT = 10
    WIFI_CONNECT_TIMEOUT = 20
    AUTO_UPDATE_INTERVAL = 300

# Overclock to 200MHz for better performance
machine.freq(200000000)

# Initialize display FIRST (before network)
print("Initializing display...")
cosmic = CosmicUnicorn()
graphics = PicoGraphics(DISPLAY)
brightness = 0.5
cosmic.set_brightness(brightness)
print("Display ready")

# Audio player will be created on-demand in play_cheer() to avoid hardware state issues
# GPIO pins: left=0, right=10, data=11, clock=9, amp_enable=22
sound = None
if AUDIO_AVAILABLE:
    print("Audio module available")
else:
    print("Audio module not available - sound disabled")

def play_cheer():
    """Play the cheer sound effect"""
    global sound
    
    if not AUDIO_AVAILABLE:
        return
    
    print("play_cheer: Starting")
    
    # Recreate WavPlayer each time to reset hardware state
    # This prevents hanging on subsequent calls
    try:
        # Clean up old instance if it exists
        if sound is not None:
            try:
                if hasattr(sound, 'stop'):
                    sound.stop()
            except:
                pass
            # Delete the old instance
            del sound
            sound = None
        
        # Force garbage collection to free resources
        gc.collect()
        time.sleep(0.1)
        
        print("play_cheer: Creating new WavPlayer")
        # Create fresh WavPlayer instance
        sound = WavPlayer(0, 10, 11, 9, amp_enable=22)
        print("play_cheer: WavPlayer created")
        
        # Small delay to let hardware initialize
        time.sleep(0.1)
        
        print("play_cheer: Calling play_wav")
        # Play the sound (False = non-blocking)
        sound.play_wav("Cheer.wav", False)
        print("play_cheer: play_wav called successfully")
        
        # Small delay after starting playback
        time.sleep(0.05)
        
    except MemoryError as e:
        print(f"Memory error playing sound: {e}")
        gc.collect()
        sound = None
    except Exception as e:
        print(f"Error playing sound: {e}")
        # Clean up on error
        try:
            if sound is not None and hasattr(sound, 'stop'):
                sound.stop()
        except:
            pass
        sound = None
        # Continue execution - don't let audio failure hang the device

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
        
        # Create pens for palette (reuse graphics context, no need to store)
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
        
        # Clear pens list to free memory (pens are managed by graphics context)
        del pens
        del rgb_palette
        gc.collect()
        
        return True
    except Exception as e:
        print(f"Error drawing artwork: {e}")
        gc.collect()
        return False

def fetch_next_artwork():
    """Fetch next artwork from API"""
    resp = None
    try:
        # Force garbage collection before network request to free memory
        gc.collect()
        
        url = f"{API_URL}/api/next?secret={API_SECRET}"
        print(f"Fetching: {url}")
        resp = urequests.get(url, timeout=REQUEST_TIMEOUT)
        
        if resp.status_code == 200:
            data = resp.json()
            resp.close()
            resp = None  # Clear reference
            # Force garbage collection after parsing JSON
            gc.collect()
            return data
        else:
            print(f"HTTP {resp.status_code}")
            resp.close()
            resp = None
            return None
    except Exception as e:
        print(f"Error fetching artwork: {e}")
        if resp:
            try:
                resp.close()
            except:
                pass
        gc.collect()  # Clean up on error
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
    while not wlan.isconnected() and timeout < WIFI_CONNECT_TIMEOUT:
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
    # Only play cheer for new artwork (display_count <= 1) and not during quiet hours
    if current_artwork.get("display_count", 0) <= 1 and not current_artwork.get("quiet_hours", False):
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
            # Clear old artwork reference before playing audio to free memory
            current_artwork = None
            gc.collect()
            
            # Only play cheer for new artwork (display_count <= 1) and not during quiet hours
            if next_artwork.get("display_count", 0) <= 1 and not next_artwork.get("quiet_hours", False):
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
        if time.time() - last_auto_update >= AUTO_UPDATE_INTERVAL:
            print("Auto-updating artwork...")
            next_artwork = fetch_next_artwork()
            if next_artwork and "drawing" in next_artwork:
                draw_artwork(next_artwork["drawing"])
                # Clear old artwork reference before playing audio to free memory
                current_artwork = None
                gc.collect()
                
                # Only play cheer for new artwork (display_count <= 1) and not during quiet hours
                if next_artwork.get("display_count", 0) <= 1 and not next_artwork.get("quiet_hours", False):
                    play_cheer()
                
                current_artwork = next_artwork
                print(f"Displaying artwork by {next_artwork.get('artist', 'Unknown')}")
            last_auto_update = time.time()
        
        cosmic.update(graphics)
    
    # Small delay to prevent USB serial issues
    time.sleep(0.001)

