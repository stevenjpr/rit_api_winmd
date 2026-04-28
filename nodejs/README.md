# Node.js Sample

Calls the Remote Iteration API from Node.js using [koffi](https://koffi.dev) —
a pre-built FFI library that requires no native compilation.

## Prerequisites

- Node.js 18 or later (v22 recommended)
- Remote device paired with this PC via Xbox PC Toolbox
- `wdEndpoint` running on the remote device — see [Remote Game Dev Tools](https://learn.microsoft.com/en-us/gaming/gdk/docs/gdk-dev/pc-dev/overviews/remote-gamedev-tools?view=gdk-2604)

## Setup

```
cd nodejs
npm install
```

This installs `koffi` from `package.json`. No other dependencies are needed.

## Configuration

Open `rit_sample.js` and edit the four constants near the top of the file:

| Variable | Description |
|---|---|
| `REMOTE_DEVICE` | IP address or hostname of the remote Handheld (e.g. `'192.168.1.10'`) |
| `SOURCE_PATH` | Directory on **this PC** to copy to the Handheld |
| `DESTINATION_PATH` | Destination path on the **Handheld** (relative to the common root) |
| `REMOTE_EXE_PATH` | Path to the executable on the **Handheld** to launch after copying |

`DESTINATION_PATH` and `REMOTE_EXE_PATH` are relative to the device's common root
(`C:\ProgramData\Microsoft GDK\gameroot` by default).

## Running

```
node rit_sample.js
```

Or open `rit_sample.js` in VS Code and press **F5** (select **Node.js** as the debugger).

## Files

| File | Description |
|---|---|
| `wdremoteapi.js` | koffi projections for all API structs, callback prototypes, and functions |
| `rit_sample.js` | Sample script: copy files then launch the game |
| `package.json` | npm project file listing the `koffi` dependency |
