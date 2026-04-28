# PowerShell Sample

Calls the Remote Iteration API via a self-contained PowerShell module (`RitApi.psm1`) that
wraps `wdremoteapi.dll` using inline C# P/Invoke compiled at import time with `Add-Type`.

## Prerequisites

- PowerShell 7.2 or later (`pwsh`)
- Windows 11, x64 or ARM64
- Remote device paired with this PC via Xbox PC Toolbox
- `wdEndpoint` running on the remote device

## Configuration

Open `rit_sample.ps1` and edit the four variables in the `#region --- Configuration ---` block:

| Variable | Description |
|---|---|
| `$REMOTE_DEVICE` | IP address or hostname of the remote Handheld (e.g. `'192.168.1.10'`) |
| `$SOURCE_PATH` | Directory on **this PC** to copy to the Handheld |
| `$DESTINATION_PATH` | Destination path on the **Handheld** (relative to the common root) |
| `$REMOTE_EXE` | Path to the executable on the **Handheld** to launch after copying |

`$DESTINATION_PATH` and `$REMOTE_EXE` are relative to the device's common root
(`C:\ProgramData\Microsoft GDK\gameroot` by default).

## Running

```powershell
cd powershell
.\rit_sample.ps1
```

Or open `rit_sample.ps1` in VS Code and press **F5** (select **PowerShell** as the debugger).

If you see a script execution policy error, run this once:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## Files

| File | Description |
|---|---|
| `RitApi.psm1` | PowerShell module: inline C# types, P/Invoke bindings, and five exported cmdlets |
| `RitApi.psd1` | Module manifest |
| `rit_sample.ps1` | Sample script: copy files, register the game, then launch it |

## Exported Cmdlets

| Cmdlet | Description |
|---|---|
| `Copy-RitFiles` | Copy a directory to (or from) a remote device |
| `Start-RitGame` | Launch a game executable on a remote device |
| `Stop-RitGame` | Terminate the running game on a remote device |
| `Resume-RitGame` | Resume a suspended game on a remote device |
| `Register-RitGame` | Register an Xbox game on a remote device |

Use `Get-Help <cmdlet>` for full parameter documentation.
