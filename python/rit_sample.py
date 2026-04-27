"""
rit_sample.py - Copy files to a remote Handheld device and launch an executable.

Before running:
  1. Set REMOTE_DEVICE to your Handheld's IP address or hostname.
  2. Set SOURCE_PATH to the file or folder on this PC you want to copy.
  3. Set DESTINATION_PATH to the path on the Handheld to copy into.
  4. Set REMOTE_EXE_PATH to the full path of the executable on the Handheld.
"""

import ctypes
import os
import sys
from wdremoteapi import WdRemoteApi, check_hr

# ---------------------------------------------------------------------------
# Configuration — edit these values before running
# ---------------------------------------------------------------------------

REMOTE_DEVICE    = "192.168.0.6"          # IP or hostname of your Handheld
SOURCE_PATH      = r"C:\rit\SimpleTriangleDesktop\Samples\IntroGraphics\SimpleTriangleDesktop\x64\Debug"     # Directory on this PC to copy
DESTINATION_PATH = r"SimpleTriangleDesktop"       # Destination directory on the Handheld

# Full path to the executable on the Handheld (under the common root, e.g. "SimpleTriangleDesktop\SimpleTriangleDesktop.exe")
REMOTE_EXE_PATH  = r"SimpleTriangleDesktop\SimpleTriangleDesktop.exe"

# ---------------------------------------------------------------------------
# Locate the DLL relative to this script (repo-root\packages\...\x64)
# ---------------------------------------------------------------------------

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT  = os.path.dirname(_SCRIPT_DIR)
DLL_PATH = os.path.join(
    _REPO_ROOT, "packages",
    "Microsoft.GDK.RemoteIterationClientApi.0.1.1-preview.26.3.27002",
    "native", "windows", "bin", "x64", "wdremoteapi.dll",
)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Verify the DLL exists before trying to load it
    if not os.path.exists(DLL_PATH):
        print(f"ERROR: DLL not found at:\n  {DLL_PATH}")
        sys.exit(1)

    print(f"Loading DLL: {DLL_PATH}")
    api = WdRemoteApi(DLL_PATH)
    print("DLL loaded successfully.\n")

    # ------------------------------------------------------------------
    # Copy files to the Handheld
    # ------------------------------------------------------------------
    print(f"Remote device : {REMOTE_DEVICE}")
    print(f"Source        : {SOURCE_PATH}")
    print(f"Destination   : {DESTINATION_PATH}")
    print("\nStarting copy...")

    hr = api.WdRemoteCopy(
        REMOTE_DEVICE.encode(),     # remote device address
        SOURCE_PATH.encode(),       # source on this PC
        DESTINATION_PATH.encode(),  # destination on the Handheld
        None,                       # copyOptions:      default (CopyTo, default root)
        None,                       # searchOptions:    copy all files
        None,                       # statusCallbacks:  no progress reporting yet
        None,                       # cancellationHandle: not used
    )
    check_hr(hr, "WdRemoteCopy")
    print("Copy completed successfully.\n")

    # ------------------------------------------------------------------
    # Launch the executable on the Handheld
    # ------------------------------------------------------------------
    print(f"Launching      : {REMOTE_EXE_PATH}")
    print(f"On device      : {REMOTE_DEVICE}")

    process_id = ctypes.c_uint32(0)
    thread_id  = ctypes.c_uint32(0)

    hr = api.WdLaunchRemoteGame(
        REMOTE_DEVICE.encode(),    # remoteDevice
        REMOTE_EXE_PATH.encode(),  # remotePath — path to exe on the Handheld
        None,                      # args — no command-line arguments
        None,                      # launchOptions — default (Immediate mode)
        ctypes.byref(process_id),  # receives the process ID (optional)
        ctypes.byref(thread_id),   # receives the thread ID (optional)
    )
    check_hr(hr, "WdLaunchRemoteGame")
    print(f"Launched successfully. PID={process_id.value}  TID={thread_id.value}")


if __name__ == "__main__":
    main()
