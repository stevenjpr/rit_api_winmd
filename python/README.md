# Python Sample

Calls the Remote Iteration API to copy files to a remote Handheld device and launch an executable.

## Prerequisites

- Python 3.9 or later
- A virtual environment (recommended): the `python/` directory includes a `.venv` setup
- Remote device paired with this PC via Xbox PC Toolbox
- `wdEndpoint` running on the remote device — see [Remote Game Dev Tools](https://learn.microsoft.com/en-us/gaming/gdk/docs/gdk-dev/pc-dev/overviews/remote-gamedev-tools?view=gdk-2604)

## Setup

```
cd python
python -m venv .venv
.venv\Scripts\activate
```

No additional packages are needed — the sample uses Python's built-in `ctypes` module.

## Configuration

Open `rit_sample.py` and edit the four variables at the top of the file:

| Variable | Description |
|---|---|
| `REMOTE_DEVICE` | IP address or hostname of the remote Handheld (e.g. `"192.168.1.10"`) |
| `SOURCE_PATH` | Directory on **this PC** to copy to the Handheld |
| `DESTINATION_PATH` | Destination path on the **Handheld** (relative to the common root) |
| `REMOTE_EXE_PATH` | Path to the executable on the **Handheld** to launch after copying |

`DESTINATION_PATH` and `REMOTE_EXE_PATH` are relative to the device's common root
(`C:\ProgramData\Microsoft GDK\gameroot` by default).

## Running

```
python rit_sample.py
```

Or press **F5** in VS Code with the Python extension installed.

## Files

| File | Description |
|---|---|
| `wdremoteapi.py` | ctypes projections for all API structs, callbacks, and functions |
| `rit_sample.py` | Sample script: copy files then launch the game |
