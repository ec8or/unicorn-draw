"""
WiFi setup helper for Raspberry Pi Pico
Run this once to connect to WiFi, or import it in your main script.
"""

import network
import time


def connect_wifi(ssid, password, timeout=30):
    """
    Connect to WiFi network.
    
    Args:
        ssid: WiFi network name
        password: WiFi password
        timeout: Maximum time to wait for connection (seconds)
    
    Returns:
        True if connected, False otherwise
    """
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if wlan.isconnected():
        print(f"Already connected to: {wlan.config('ssid')}")
        print(f"IP address: {wlan.ifconfig()[0]}")
        return True
    
    print(f"Connecting to WiFi: {ssid}...")
    wlan.connect(ssid, password)
    
    # Wait for connection
    start_time = time.time()
    while not wlan.isconnected() and (time.time() - start_time) < timeout:
        print(".", end="")
        time.sleep(1)
    
    if wlan.isconnected():
        ip = wlan.ifconfig()[0]
        print(f"\nConnected! IP address: {ip}")
        return True
    else:
        print(f"\nFailed to connect to {ssid}")
        print("Check your SSID and password")
        return False


def get_wifi_status():
    """Check current WiFi connection status."""
    wlan = network.WLAN(network.STA_IF)
    if wlan.active():
        if wlan.isconnected():
            config = wlan.ifconfig()
            return {
                'connected': True,
                'ip': config[0],
                'netmask': config[1],
                'gateway': config[2],
                'dns': config[3],
                'ssid': wlan.config('ssid')
            }
        else:
            return {'connected': False}
    else:
        return {'connected': False, 'active': False}


# Example usage:
if __name__ == "__main__":
    # Replace with your WiFi credentials
    WIFI_SSID = "your-wifi-name"
    WIFI_PASSWORD = "your-wifi-password"
    
    # Connect
    if connect_wifi(WIFI_SSID, WIFI_PASSWORD):
        status = get_wifi_status()
        print(f"Status: {status}")
    else:
        print("WiFi connection failed")

