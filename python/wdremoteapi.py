"""
wdremoteapi.py - Python ctypes projections for the Remote Iteration API.

Maps structs, enums, callbacks, and function signatures from WdRemoteIteration.h
to Python ctypes types. Import this module and create a WdRemoteApi instance
to call the API functions.

The DLL (wdremoteapi.dll) must be on disk; pass its path to WdRemoteApi().
All string parameters are UTF-8 bytes (e.g. b"192.168.1.10" or "...".encode()).
"""

import ctypes
import enum
from ctypes import (
    c_char_p, c_uint32, c_uint64, c_size_t, c_void_p, c_long, POINTER
)

# ---------------------------------------------------------------------------
# HRESULT helpers
# ---------------------------------------------------------------------------

# Remote Iteration API-specific error codes and their descriptions.
_WD_ERRORS: dict[int, tuple[str, str]] = {
    0x8C114008: ("E_CLIENTNOTAUTHORIZED",  "Device rejected this client. Complete PIN pairing first."),
    0x8C114009: ("E_SERVERNOTAUTHORIZED",  "Client rejected the device. Complete PIN pairing first."),
    0x8C114011: ("E_SERVERTOOOLD",         "Server version is too old. Update wdEndpoint on the remote device."),
    0x8C114012: ("E_NAMERESOLUTIONFAILED", "Could not resolve the remote hostname. Check DNS or use an IP address."),
    0x8C114013: ("E_INVALIDADDRESS",       "Invalid or malformed address. Confirm the IP is correct IPv4."),
    0x8C114014: ("E_CONNECTIONERROR",      "Network connection failed. Check connectivity and firewall rules."),
    0x8C114016: ("E_ADMIN_REQUIRED",       "Administrator privileges required. Re-run the endpoint as Administrator."),
}

def SUCCEEDED(hr: int) -> bool:
    return (hr & 0xFFFFFFFF) <= 0x7FFFFFFF

def FAILED(hr: int) -> bool:
    return not SUCCEEDED(hr)

def hresult_message(hr: int) -> str:
    """Return a human-readable description for an HRESULT value."""
    code = hr & 0xFFFFFFFF
    if code in _WD_ERRORS:
        name, description = _WD_ERRORS[code]
        return f"0x{code:08X} ({name}): {description}"
    return f"0x{code:08X}"

def check_hr(hr: int, fn_name: str = "API call") -> int:
    """Raise OSError with a readable message if hr indicates failure; otherwise return hr."""
    if FAILED(hr):
        raise OSError(f"{fn_name} failed: {hresult_message(hr)}")
    return hr

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class WdCopyDirection(enum.IntEnum):
    CopyTo   = 0
    CopyFrom = 1

class WdCopyErrorSeverity(enum.IntEnum):
    Warning = 0
    Error   = 1

class WdLaunchMode(enum.IntEnum):
    Immediate = 0
    Suspended = 1

# ---------------------------------------------------------------------------
# Structs
# ---------------------------------------------------------------------------

class WdCopyFileProgressInfo(ctypes.Structure):
    """Progress for a single file in a copy operation."""
    _fields_ = [
        ("relativeFilePath", c_char_p),   # UTF-8, relative to destination root
        ("sourcePath",       c_char_p),   # UTF-8
        ("destinationPath",  c_char_p),   # UTF-8
        ("bytesTransferred", c_uint64),
        ("fileSize",         c_uint64),
    ]

class WdCopyOperationSummary(ctypes.Structure):
    """Overall progress summary for a copy operation."""
    _fields_ = [
        ("filesCompletedCount",   c_uint64),
        ("bytesTransferredCount", c_uint64),
        ("totalFileCount",        c_uint64),
        ("totalByteCount",        c_uint64),
    ]

class WdCopyOptions(ctypes.Structure):
    """Controls copy direction and optional common root alias."""
    _fields_ = [
        ("copyDirection",   c_uint32),   # WdCopyDirection value
        ("commonRootAlias", c_char_p),   # UTF-8, optional (None = default root)
    ]

class WdCopySearchOptions(ctypes.Structure):
    """File filter patterns and attribute flags for a copy operation.

    Pattern strings are semicolon-separated and support * and ? wildcards.
    Pass None for any field to use the default (include all / exclude none).
    """
    _fields_ = [
        ("includeFilePattern",    c_char_p),   # e.g. b"*.exe;*.dll"
        ("excludeFilePattern",    c_char_p),
        ("excludeDirPattern",     c_char_p),
        ("includeFileAttributes", c_uint64),   # FILE_ATTRIBUTE_* flags; 0 = all
        ("excludeFileAttributes", c_uint64),   # FILE_ATTRIBUTE_* flags; 0 = none
    ]

# Callback types must be defined before WdCopyStatusCallbacks.
# CFUNCTYPE uses cdecl calling convention, matching the DLL.

WdCopyFilesStatusCallback = ctypes.CFUNCTYPE(
    c_long,                           # return: HRESULT
    c_size_t,                         # fileProgressCount
    POINTER(WdCopyFileProgressInfo),  # fileUpdates (array of fileProgressCount items)
    POINTER(WdCopyOperationSummary),  # copyUpdates
    c_void_p,                         # context
)
"""Callback invoked periodically with per-file and overall copy progress.
Returning a failed HRESULT aborts the copy and that HRESULT is returned from WdRemoteCopy."""

WdCopyErrorCallback = ctypes.CFUNCTYPE(
    c_long,    # return: HRESULT
    c_uint32,  # severity (WdCopyErrorSeverity)
    c_char_p,  # message
    c_long,    # error (HRESULT; S_OK for warnings)
    c_void_p,  # context
)
"""Callback invoked when the copy operation emits a warning or error message."""

class WdCopyStatusCallbacks(ctypes.Structure):
    """Bundles progress and error callbacks with a shared context pointer."""
    _fields_ = [
        ("copyFilesStatusCallback", WdCopyFilesStatusCallback),  # optional
        ("refreshRateMs",           c_uint32),                   # 0 = default 500 ms
        ("copyErrorCallback",       WdCopyErrorCallback),        # optional
        ("context",                 c_void_p),                   # passed to both callbacks
    ]

class WdLaunchOptions(ctypes.Structure):
    """Controls how a remote game is launched."""
    _fields_ = [
        ("launchMode",      c_uint32),   # WdLaunchMode value
        ("commonRootAlias", c_char_p),   # UTF-8, optional
    ]

# ---------------------------------------------------------------------------
# Opaque handle  (WdCancellationHandle is a pointer to an opaque struct)
# ---------------------------------------------------------------------------

WdCancellationHandle = c_void_p

# ---------------------------------------------------------------------------
# API wrapper
# ---------------------------------------------------------------------------

class WdRemoteApi:
    """
    Thin wrapper around wdremoteapi.dll.

    Example:
        api = WdRemoteApi(r"C:\\path\\to\\wdremoteapi.dll")
        pid = ctypes.c_uint32()
        hr = api.WdLaunchRemoteGame(
            b"192.168.1.10",
            b"D:\\\\Games\\\\MyGame\\\\game.exe",
            None, None,
            ctypes.byref(pid), None
        )
        check_hr(hr, "WdLaunchRemoteGame")
    """

    def __init__(self, dll_path: str):
        self._dll = ctypes.CDLL(dll_path)
        self._bind()

    def _bind(self):
        dll = self._dll

        dll.WdCreateCancellationHandle.restype  = c_long
        dll.WdCreateCancellationHandle.argtypes = [POINTER(WdCancellationHandle)]

        dll.WdCloseCancellationHandle.restype   = None
        dll.WdCloseCancellationHandle.argtypes  = [WdCancellationHandle]

        dll.WdDuplicateCancellationHandle.restype  = c_long
        dll.WdDuplicateCancellationHandle.argtypes = [
            WdCancellationHandle,
            POINTER(WdCancellationHandle),
        ]

        # Blocking. Only one WdRemoteCopy may be active at a time.
        dll.WdRemoteCopy.restype  = c_long
        dll.WdRemoteCopy.argtypes = [
            c_char_p,                        # remoteDevice
            c_char_p,                        # sourcePath
            c_char_p,                        # destinationPath
            POINTER(WdCopyOptions),          # copyOptions (optional)
            POINTER(WdCopySearchOptions),    # searchOptions (optional)
            POINTER(WdCopyStatusCallbacks),  # statusCallbacks (optional)
            WdCancellationHandle,            # cancellationHandle (optional)
        ]

        dll.WdCancelRemoteCopy.restype  = c_long
        dll.WdCancelRemoteCopy.argtypes = [WdCancellationHandle]

        dll.WdLaunchRemoteGame.restype  = c_long
        dll.WdLaunchRemoteGame.argtypes = [
            c_char_p,                  # remoteDevice
            c_char_p,                  # remotePath
            c_char_p,                  # args (optional)
            POINTER(WdLaunchOptions),  # launchOptions (optional)
            POINTER(c_uint32),         # processId (out, optional)
            POINTER(c_uint32),         # threadId (out, optional)
        ]

        dll.WdResumeRemoteGame.restype  = c_long
        dll.WdResumeRemoteGame.argtypes = [c_char_p]

        dll.WdTerminateRemoteGame.restype  = c_long
        dll.WdTerminateRemoteGame.argtypes = [c_char_p]

        dll.WdRegisterRemoteXboxGame.restype  = c_long
        dll.WdRegisterRemoteXboxGame.argtypes = [
            c_char_p,  # remoteDevice
            c_char_p,  # remoteFolderPath
            c_char_p,  # commonRootAlias (optional)
        ]

    # Expose each function as a direct attribute for convenient call-site syntax.

    @property
    def WdCreateCancellationHandle(self):
        return self._dll.WdCreateCancellationHandle

    @property
    def WdCloseCancellationHandle(self):
        return self._dll.WdCloseCancellationHandle

    @property
    def WdDuplicateCancellationHandle(self):
        return self._dll.WdDuplicateCancellationHandle

    @property
    def WdRemoteCopy(self):
        return self._dll.WdRemoteCopy

    @property
    def WdCancelRemoteCopy(self):
        return self._dll.WdCancelRemoteCopy

    @property
    def WdLaunchRemoteGame(self):
        return self._dll.WdLaunchRemoteGame

    @property
    def WdResumeRemoteGame(self):
        return self._dll.WdResumeRemoteGame

    @property
    def WdTerminateRemoteGame(self):
        return self._dll.WdTerminateRemoteGame

    @property
    def WdRegisterRemoteXboxGame(self):
        return self._dll.WdRegisterRemoteXboxGame
