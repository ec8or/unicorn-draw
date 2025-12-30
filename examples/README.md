# Cosmic Unicorn Examples

Example scripts for displaying pixel art from the gallery on Pimoroni Cosmic Unicorn (32×32 LED matrix).

## Gallery Display (`gallery_display.py`)

Main script for displaying artworks from the gallery. This script:

- Fetches artworks from the `/api/next` endpoint
- Displays them on the Cosmic Unicorn
- Auto-updates every 5 minutes
- Allows manual cycling with A button press
- Supports brightness controls and sleep mode

### Setup

1. **Update configuration** in `gallery_display.py`:
   ```python
   SSID = "YOUR_WIFI_SSID"
   PASSWORD = "YOUR_WIFI_PASSWORD"
   API_URL = "http://your-server.com"  # Your server URL
   API_SECRET = "your-secret-here"  # From server environment or hardcoded fallback
   ```

2. **Upload to Pico**:
   - Copy `gallery_display.py` to your Pico
   - Make sure you have `cosmic.py` and `picographics` library installed
   - Run the script

### Controls

- **A button**: Manually cycle to next artwork
- **B/C/D buttons**: Reset device
- **Brightness Up/Down**: Adjust display brightness
- **Sleep button**: Toggle sleep mode (fades display)

### Features

- **Auto-update**: Fetches new artwork every 5 minutes automatically
- **Manual cycling**: Press A button to immediately fetch next artwork
- **Error handling**: Shows error pattern if connection fails
- **WiFi reconnection**: Handles WiFi connection with timeout

## Other Examples

- `cosmic_unicorn.py` - Legacy example for fetching from `/api/latest`
- `display_test.py` - Test script with hardcoded data
- `wifi_setup.py` - WiFi connection helper functions
