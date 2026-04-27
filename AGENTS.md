Session Instructions
====================

Purpose
- Build small sample programs in various languages that call the Remote Iteration API.
- Use the NuGet package `Microsoft.GDK.RemoteIterationClientApi` as the primary source for API assets and metadata.

Current Focus
- Create minimal, working samples in C#, Python, and PowerShell.

Working Preferences
- Keep examples small and easy to run.
- Prefer clear setup steps and minimal dependencies.
- Capture assumptions explicitly when API behavior is unclear.

Sample Languages
- C# (csharp/)
- Python (python/)
- PowerShell (powershell/)

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
