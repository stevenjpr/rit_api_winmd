"""
rit_sample.py - Copy a file from this PC to a remote Handheld device
using the Remote Iteration API.

Before running:
  1. Set REMOTE_DEVICE to your Handheld's IP address or hostname.
  2. Set SOURCE_PATH to the file or folder on this PC you want to copy.
  3. Set DESTINATION_PATH to the path on the Handheld to copy into.
"""

import os
import sys
from wdremoteapi import WdRemoteApi, check_hr

# ---------------------------------------------------------------------------
# Configuration — edit these values before running
# ---------------------------------------------------------------------------

REMOTE_DEVICE    = "192.168.1.100"          # IP or hostname of your Handheld
SOURCE_PATH      = r"C:\path\to\source"     # Directory on this PC to copy
DESTINATION_PATH = r"C:\Games\MyGame"       # Destination directory on the Handheld (absolute path)

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
    print("Copy completed successfully.")


if __name__ == "__main__":
    main()
