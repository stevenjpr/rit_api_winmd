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
from wdremoteapi import (
    WdRemoteApi, WdCopyStatusCallbacks,
    WdCopyFilesStatusCallback, WdCopyErrorCallback,
    WdCopyErrorSeverity, check_hr,
)

# ---------------------------------------------------------------------------
# Configuration — edit these values before running
# ---------------------------------------------------------------------------

REMOTE_DEVICE    = "192.168.0.6"          # IP or hostname of your Handheld
SOURCE_PATH      = r"C:\rit\SimpleTriangleDesktop\Samples\IntroGraphics\SimpleTriangleDesktop\x64\Debug"     # Directory on this PC to copy
DESTINATION_PATH = r"SimpleTriangleDesktop"       # Destination directory on the Handheld

# Full path to the executable on the Handheld (under the common root, e.g. "SimpleTriangleDesktop\SimpleTriangleDesktop.exe")
REMOTE_EXE_PATH  = r"SimpleTriangleDesktop\SimpleTriangleDesktop.exe"

# ---------------------------------------------------------------------------
# Progress helpers
# ---------------------------------------------------------------------------

def _fmt_bytes(n: int) -> str:
    """Format a byte count as a human-readable string."""
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f} {unit}"
        n /= 1024


@WdCopyFilesStatusCallback
def _on_copy_progress(file_progress_count, file_updates, copy_summary, _ctx):
    """Called periodically by WdRemoteCopy with per-file and overall progress."""
    s = copy_summary.contents
    total_files = s.totalFileCount
    done_files  = s.filesCompletedCount
    total_bytes = s.totalByteCount
    done_bytes  = s.bytesTransferredCount

    # Overall progress bar (40 chars wide)
    pct   = (done_bytes / total_bytes * 100) if total_bytes else 0
    bar_w = 40
    filled = int(bar_w * pct / 100)
    bar = "#" * filled + "-" * (bar_w - filled)

    # Active file (last entry in the per-file array, if any)
    active = ""
    if file_progress_count > 0:
        f = file_updates[file_progress_count - 1]
        name = (f.relativeFilePath or b"").decode(errors="replace")
        active = f"  {name} ({_fmt_bytes(f.bytesTransferred)}/{_fmt_bytes(f.fileSize)})"

    print(
        f"\r[{bar}] {pct:5.1f}%  "
        f"{done_files}/{total_files} files  "
        f"{_fmt_bytes(done_bytes)}/{_fmt_bytes(total_bytes)}"
        f"{active:<60}",
        end="", flush=True,
    )
    return 0  # S_OK — continue the copy


@WdCopyErrorCallback
def _on_copy_error(severity, message, error, _ctx):
    """Called by WdRemoteCopy when a warning or error occurs during the copy."""
    label = "WARNING" if severity == WdCopyErrorSeverity.Warning else "ERROR"
    msg   = (message or b"").decode(errors="replace")
    print(f"\n[{label}] {msg} (hr=0x{error & 0xFFFFFFFF:08X})")
    return 0  # S_OK — let the copy continue


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

    callbacks = WdCopyStatusCallbacks(
        copyFilesStatusCallback = _on_copy_progress,
        refreshRateMs           = 250,    # update ~4 times/sec
        copyErrorCallback       = _on_copy_error,
        context                 = None,
    )

    hr = api.WdRemoteCopy(
        REMOTE_DEVICE.encode(),     # remote device address
        SOURCE_PATH.encode(),       # source on this PC
        DESTINATION_PATH.encode(),  # destination on the Handheld
        None,                       # copyOptions:   default (CopyTo, default root)
        None,                       # searchOptions: copy all files
        ctypes.byref(callbacks),    # statusCallbacks: progress + error reporting
        None,                       # cancellationHandle: not used
    )
    print()  # newline after the progress bar
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
