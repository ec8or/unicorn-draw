# Micropython Examples

Example scripts for displaying unicorn-draw drawings on Pimoroni Cosmic Unicorn (32×32 LED matrix).

## cosmic_unicorn.py

Fetches the shared drawing from your deployed server and displays it on the Cosmic Unicorn.

### Setup

1. **Update the server URL** in `cosmic_unicorn.py`:
   ```python
   SERVER_URL = "http://your-server.com"  # Change this!
   ```

2. **Copy to your Pico**:
   - Upload `cosmic_unicorn.py` to your Raspberry Pi Pico
   - Ensure you have the required libraries installed:
     - `cosmic` (from Pimoroni)
     - `picographics` (from Pimoroni)
     - `network` (built-in)
     - `urequests` (install via Thonny or manually)

3. **Configure WiFi** (required):
   - Your Pico needs to be connected to WiFi to fetch from the server
   - **Option A**: Run `wifi_setup.py` once (edit it with your WiFi credentials first)
   - **Option B**: Add WiFi credentials to `cosmic_unicorn.py` and uncomment the auto-connect code
   - **Option C**: Use your own WiFi connection method
   
   Example with `wifi_setup.py`:
   ```python
   # Edit wifi_setup.py and set:
   WIFI_SSID = "your-wifi-name"
   WIFI_PASSWORD = "your-wifi-password"
   
   # Then run it once:
   # python wifi_setup.py
   ```

### Usage

Run the script on your Pico. It will:
- Fetch the latest drawing from `/api/latest` every 2 seconds
- Fall back to `/drawings/latest.json` if the API endpoint isn't available
- Display the drawing on the Cosmic Unicorn
- Handle errors gracefully (shows last known drawing on network errors)

### Customization

- **Update interval**: Change `UPDATE_INTERVAL` (default: 2.0 seconds)
- **Error handling**: Modify the fallback behavior in `fetch_drawing()`
- **Display behavior**: Adjust what happens when no drawing is available

