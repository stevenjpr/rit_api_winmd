Session Instructions
====================

Purpose
- Build small sample programs in various languages that call the Remote Iteration API.
- Use the NuGet package `Microsoft.GDK.RemoteIterationClientApi` as the primary source for API assets and metadata.

Current Focus
- Create minimal, working samples in C#, Python, PowerShell, and Node.js.

Working Preferences
- Keep examples small and easy to run.
- Prefer clear setup steps and minimal dependencies.
- Capture assumptions explicitly when API behavior is unclear.

Sample Languages
- C# (csharp/)
- Python (python/)
- PowerShell (powershell/)
- Node.js (nodejs/)

NuGet Package
- Package: Microsoft.GDK.RemoteIterationClientApi
- Current version: 0.1.1-preview.26.3.27002
- Location: packages/
- API docs: https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/remoting/remoteiteration_members?view=gdk-2510

API Overview
- Header: WdRemoteIteration.h
- Library: wdremoteapi.lib
- WinMD: wdremoteapi.winmd (for language projections)
- Supported OS: Windows 11 and later
- Supported architectures: x64, ARM64

Prerequisites (for running samples)
- PC and remote device paired via Xbox PC Toolbox
- wdEndpoint installed and running on the remote device

API Functions
- WdRemoteCopy                  Copy files to/from remote device (delta-aware)
- WdCancelRemoteCopy            Cancel an in-progress copy
- WdCreateCancellationHandle    Create a cancellation handle
- WdCloseCancellationHandle     Close a cancellation handle
- WdDuplicateCancellationHandle Duplicate a cancellation handle
- WdLaunchRemoteGame            Launch a game on the remote device
- WdResumeRemoteGame            Resume a suspended game
- WdTerminateRemoteGame         Terminate a running game
- WdRegisterRemoteXboxGame      Register a game on the remote device

Key API Rules
- Only one WdRemoteCopy may be active at a time; concurrent calls = undefined behavior.
- All functions are blocking.
- WdCancelRemoteCopy is thread-safe and non-blocking.
- No persistent connection between calls — each call reconnects.
- No automatic retry on failure; caller is responsible for retrying.
- Delta copy: only missing or changed files are transferred on retry.

String Encoding
- ALL strings in wdremoteapi.dll are UTF-8 (const char*), not wide strings (PCWSTR).
- Python: use b"..." or "...".encode() for all string parameters.
- PowerShell/C#: use [MarshalAs(UnmanagedType.LPUTF8Str)] on DllImport string params.
- Node.js/koffi: use 'str' type, which koffi marshals as UTF-8 by default.

Struct Layout Notes (x64)
- WdCopyOptions:        uint32(4) + padding(4) + ptr(8)            = 16 bytes
- WdCopySearchOptions:  ptr(8)*3 + uint64(8)*2                     = 40 bytes
- WdCopyStatusCallbacks: fnptr(8) + uint32(4) + padding(4) + fnptr(8) + ptr(8) = 32 bytes
- WdLaunchOptions:      uint32(4) + padding(4) + ptr(8)            = 16 bytes
- WdCopyFileProgressInfo: ptr(8)*3 + uint64(8)*2                   = 40 bytes
- WdCopyOperationSummary: uint64(8)*4                              = 32 bytes
- Implicit alignment padding is added automatically by all language runtimes
  (ctypes, C#, koffi) — no explicit padding fields needed.

Progress Callbacks
- WdCopyFilesStatusCallback: called periodically with per-file and overall progress.
  Returning a failed HRESULT aborts the copy.
- WdCopyErrorCallback: called on warnings and errors during a copy.
  Returning a failed HRESULT aborts the copy.
- refreshRateMs in WdCopyStatusCallbacks: 0 = default (500 ms); 250 ms works well.
- The DLL may call callbacks from a background thread — use thread-safe output
  (Console.Write in C#/PowerShell, process.stdout.write in Node.js).

Language-Specific Notes

Python (ctypes)
- Use ctypes.CFUNCTYPE for callback types (cdecl convention).
- Callback instances must be kept alive in Python variables for the duration of
  WdRemoteCopy, or the GC will collect them and cause crashes.
- Use ctypes.byref(c_uint32()) for output parameters (processId, threadId).

PowerShell (Add-Type inline C#)
- DllImport method name can differ from the exported name; use EntryPoint= to specify
  the real DLL export name (e.g. EntryPoint = "WdRemoteCopy" on a method named WdRemoteCopyRaw).
- PS hex literals with high bit set (e.g. 0x8C114001) are parsed as signed Int32.
  Use string keys in hashtables and convert with [int64]$hr + 4294967296L for negatives.
- $Variable: is parsed as a PS scoped variable — use ${Variable} when followed by a colon.
- Use static readonly delegate fields in C# to prevent GC of callback delegates.
- Use NativeLibrary.Load($dllPath) before Add-Type so DllImport("wdremoteapi.dll")
  resolves by name without requiring the DLL to be on PATH.

Node.js (koffi)
- Use koffi (not ffi-napi) — ships pre-built binaries, no native compilation needed.
- koffi.proto() does not accept calling convention prefixes (__cdecl) in the string;
  omit them (on x64 Windows there is only one calling convention anyway).
- In callbacks, pointer parameters arrive as opaque external pointers.
  Use koffi.decode(ptr, StructType) to read a struct, and
  koffi.decode(ptr, StructType, byteOffset) for array elements where
  byteOffset = index * koffi.sizeof(StructType).
- koffi returns uint64 struct fields as JS BigInt — convert with Number() before math.
- Use koffi.register(fn, koffi.pointer(proto)) to create a native callback from a JS function.
  Hold the returned handle in a module-scope variable to prevent GC during the copy.

