# Remote Iteration API Samples

Sample programs in multiple languages that call the [Remote Iteration API](https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/remoting/remoteiteration_members?view=gdk-2510) — a Windows API for copying files to and launching executables on a remote Windows device, designed for game development workflows.

## NuGet Package

API binaries and headers are distributed via NuGet:

**[Microsoft.GDK.RemoteIterationClientApi](https://www.nuget.org/packages/Microsoft.GDK.RemoteIterationClientApi)**

The package includes `wdremoteapi.dll`, `wdremoteapi.winmd`, `WdRemoteIteration.h`, and import libraries for x64 and ARM64.
The package is checked in to the `packages/` directory in this repo so samples run without a separate restore step.

## Prerequisites

- Windows 11, x64 or ARM64
- Remote device paired with this PC via Xbox PC Toolbox
- `wdEndpoint` running on the remote device — see [Remote Game Dev Tools](https://learn.microsoft.com/en-us/gaming/gdk/docs/gdk-dev/pc-dev/overviews/remote-gamedev-tools?view=gdk-2604)

## Samples

| Directory | Language | Notes |
|---|---|---|
| `python/` | Python | Uses built-in `ctypes` — no extra packages needed |
| `powershell/` | PowerShell 7 | Self-contained module (`RitApi.psm1`) with inline C# P/Invoke |
| `nodejs/` | Node.js | Uses `koffi` for DLL binding (pre-built, no native compilation) |
| `csharp/` | C# | See the [Xbox-GDK-Samples reference on GitHub](https://github.com/microsoft/Xbox-GDK-Samples/tree/main/Samples/Tools/RemoteIterationToolsSample) |

Each directory has its own `README.md` with setup and configuration instructions.

## What the API Does

- **Copy files** to or from a remote device (delta-aware — only changed files are transferred)
- **Launch, resume, and terminate** a game executable on the remote device
- **Register** an Xbox game on the remote device
