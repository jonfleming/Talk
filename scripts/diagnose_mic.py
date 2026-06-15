import sys
import time
import numpy as np
import sounddevice as sd

def list_devices():
    print("=== AVAILABLE INPUT DEVICES ===")
    devices = sd.query_devices()
    default_input = sd.default.device[0]
    
    for i, dev in enumerate(devices):
        if dev['max_input_channels'] > 0:
            is_default = (i == default_input)
            default_marker = " [DEFAULT]" if is_default else ""
            print(f"ID {i}: {dev['name']} (Channels: {dev['max_input_channels']}, HostAPI: {dev['hostapi']}){default_marker}")
    print("===============================\n")

def test_device(device_id=None, duration=3.0):
    samplerate = 16000
    if device_id is None:
        device_id = sd.default.device[0]
        device_info = sd.query_devices(device_id)
        print(f"Testing default device ID {device_id} ({device_info['name']})...")
    else:
        device_info = sd.query_devices(device_id)
        print(f"Testing device ID {device_id} ({device_info['name']})...")
        
    print(f"Recording for {duration} seconds... Speak into your microphone!")
    try:
        audio = sd.rec(
            int(duration * samplerate),
            samplerate=samplerate,
            channels=1,
            dtype='float32',
            device=device_id
        )
        sd.wait()
    except Exception as e:
        print(f"\n[ERROR] Failed to record from device {device_id}: {e}")
        return

    print("Recording finished. Analyzing signal...")
    
    max_val = np.max(np.abs(audio))
    mean_val = np.mean(audio)
    std_val = np.std(audio)
    non_zero = np.count_nonzero(audio)
    total_samples = len(audio)
    
    print(f"  Total samples: {total_samples}")
    print(f"  Non-zero samples: {non_zero}")
    print(f"  Max amplitude: {max_val:.6f}")
    print(f"  Standard deviation: {std_val:.6f}")
    
    # 3.0517578e-05 is exactly 1/32768 (1 bit of noise)
    if max_val < 1e-4:
        print("\n[WARNING] Captured signal is extremely quiet or silent!")
        print("This usually means:")
        print(" 1. The microphone is muted (either physical switch or in Windows settings).")
        print(" 2. The wrong audio input device is set as default in Windows.")
        print(" 3. Another process has exclusive access or Windows Privacy settings are blocking input.")
        print(" 4. If you recently forwarded the device to WSL (using usbipd), it is disconnected from Windows!")
    else:
        print("\n[SUCCESS] Audio signal detected! The microphone is active and sending data.")

def monitor_levels(device_id=None):
    if device_id is None:
        device_id = sd.default.device[0]
    
    device_info = sd.query_devices(device_id)
    print(f"\n=== Real-time Volume Meter for Device {device_id} ({device_info['name']}) ===")
    print("Press Ctrl+C to stop.\n")
    
    samplerate = 16000
    block_size = 800  # 50ms blocks
    
    def callback(indata, frames, time_info, status):
        if status:
            print(status, file=sys.stderr)
        # Calculate RMS volume
        volume_norm = np.linalg.norm(indata) / np.sqrt(len(indata))
        # Draw a simple ASCII level meter
        bar_length = int(volume_norm * 100)
        bar = "#" * bar_length + "-" * (50 - bar_length)
        sys.stdout.write(f"\rLevel: [{bar[:50]}] {volume_norm:.4f}")
        sys.stdout.flush()

    try:
        with sd.InputStream(
            samplerate=samplerate,
            channels=1,
            dtype='float32',
            device=device_id,
            blocksize=block_size,
            callback=callback
        ):
            while True:
                time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nStopped monitoring.")
    except Exception as e:
        print(f"\n[ERROR] Failed to stream from device: {e}")

if __name__ == "__main__":
    list_devices()
    
    selected_device = None
    if len(sys.argv) > 1:
        try:
            selected_device = int(sys.argv[1])
        except ValueError:
            print(f"Invalid device ID '{sys.argv[1]}'. Using default device.")
            
    test_device(selected_device)
    
    # Prompt to run level meter
    print("\nWould you like to run the real-time volume meter for this device? (y/n): ", end="")
    sys.stdout.flush()
    # Read response (using non-blocking check since we are executing via run_command if needed)
    try:
        # We can just run it if they pass 'meter' in args, or default to asking
        if len(sys.argv) > 2 and sys.argv[2] == 'meter':
            monitor_levels(selected_device)
        else:
            print("\nTo run the live volume meter, run:")
            device_arg = f" {selected_device}" if selected_device is not None else ""
            print(f"  .venv\\Scripts\\python.exe scripts\\diagnose_mic.py{device_arg} meter")
    except Exception:
        pass
