# Remote Iteration Tools — VS Code Extension

Adds **Deploy**, **Launch**, and **Deploy + Launch** commands to VS Code that use the
[Xbox PC Remote Iteration API](https://learn.microsoft.com/en-us/gaming/gdk/docs/reference/remoting/remoteiteration_members?view=gdk-2510)
to deploy files and launch a game on a paired remote Windows Handheld device.

---

## Prerequisites

1. **Windows 11** (x64 or ARM64)
2. PC and remote device paired via **Xbox PC Toolbox**
3. **wdEndpoint** installed and running on the remote device
   → [Get wdEndpoint running](https://learn.microsoft.com/en-us/gaming/gdk/docs/gdk-dev/pc-dev/overviews/remote-gamedev-tools?view=gdk-2604)

---

## Setup (Development / Local Install)

### 1. Copy the NuGet packages folder

The extension loads `wdremoteapi.dll` from a `packages/` directory at its root.
Copy the `packages/` folder from the **repo root** into `vscode-extension/`:

```
robocopy ..\packages packages /E /NFL /NDL
```

Or create a junction:

```
cmd /c mklink /J packages ..\packages
```

### 2. Install Node.js dependencies

```
npm install
```

### 3. Build the extension

```
npm run compile
```

Or use `npm run watch` to rebuild on every file change.

---

## Running in the Extension Development Host

Open the `vscode-extension/` folder in VS Code, then press **F5**.
A new VS Code window launches with the extension loaded. Open the Command Palette
(`Ctrl+Shift+P`) and search for **RIT:**.

---

## Configuration

Open **File → Preferences → Settings** and search for **Remote Iteration**.

| Setting                 | Description                                      | Example                           |
|-------------------------|--------------------------------------------------|-----------------------------------|
| `rit.remoteDevice`      | IP address or hostname of the remote device      | `192.168.1.100`                   |
| `rit.sourcePath`        | Local directory to deploy                        | `C:\MyGame\Loose`                 |
| `rit.destinationPath`   | Destination path on the remote device            | `D:\DevelopmentFiles\MyGame`      |
| `rit.remoteExePath`     | Game executable path on the remote device        | `D:\DevelopmentFiles\MyGame\Game.exe` |

---

## Commands

| Command                                 | Description                          |
|-----------------------------------------|--------------------------------------|
| **RIT: Deploy Files to Remote Device**  | Copies local files to the device     |
| **RIT: Launch Game on Remote Device**   | Launches the configured executable   |
| **RIT: Deploy and Launch on Remote Device** | Deploy then launch in one step   |

Progress and log output appear in the **Remote Iteration** Output Channel
(`View → Output → Remote Iteration`).

---

## Packaging for local install

```
npm install -g @vscode/vsce
vsce package
```

Install the resulting `.vsix` via **Extensions: Install from VSIX…** in the Command Palette.
