# Remote Iteration API Samples

Sample programs in multiple languages demonstrating the [Xbox PC Remote Iteration API](https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/remoting/remoteiteration_members?view=gdk-2510) — a C-based API that lets you programmatically deploy, launch, and manage PC game builds on remote Windows devices as part of your development workflow.

Key capabilities include:
- **Delta file transfer** — copy game files between a local dev PC and a remote Windows device, transferring only changed files to minimize iteration time
- **Process lifecycle management** — launch, suspend, resume, and terminate game processes on the remote device
- **Game registration** — register games for remote execution
- **CI/automation friendly** — integrate into custom studio tools and automated deploy–launch–test pipelines

The API is intended for development and testing scenarios. One endpoint must always be the local development PC. See the [public preview announcement](https://developer.microsoft.com/en-us/games/articles/2026/04/xbox-pc-remote-iteration-api-public-preview/) for full details.

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
