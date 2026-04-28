# rit_sample.ps1 - Demonstrates using the RitApi module to deploy a game build
# to a remote Windows device and launch it.
#
# Usage:
#   .\rit_sample.ps1
#
# Run from a PowerShell 7 terminal inside VS Code, or any PS 7+ session.

#region --- Configuration ---

# IP address or hostname of the remote Handheld device.
$REMOTE_DEVICE = '192.168.0.6'

# Local directory to deploy to the remote device.
$SOURCE_PATH = 'C:\rit\SimpleTriangleDesktop\Samples\IntroGraphics\SimpleTriangleDesktop\x64\Debug'

# Destination folder name on the remote device.
# A relative path is resolved against the device's default common root
# (C:\ProgramData\Microsoft GDK\gameroot by default).
$DESTINATION_PATH = 'SimpleTriangleDesktop'

# Path to the game executable on the remote device (relative to common root).
$REMOTE_EXE = 'SimpleTriangleDesktop\SimpleTriangleDesktop.exe'

#endregion

#region --- Module Import ---

$moduleFile = Join-Path $PSScriptRoot 'RitApi.psm1'
if (-not (Get-Module -Name RitApi)) {
    Import-Module $moduleFile
}

#endregion

#region --- Deploy ---

Write-Host "Deploying '$SOURCE_PATH' to $REMOTE_DEVICE ..."

try {
    Copy-RitFiles `
        -RemoteDevice    $REMOTE_DEVICE `
        -SourcePath      $SOURCE_PATH `
        -DestinationPath $DESTINATION_PATH `
        -Verbose

    Write-Host "Deploy succeeded." -ForegroundColor Green
}
catch {
    Write-Host "Deploy failed: $_" -ForegroundColor Red
    exit 1
}

#endregion

#region --- Register and Launch ---

Write-Host "Registering game on $REMOTE_DEVICE ..."
try {
    Register-RitGame -RemoteDevice $REMOTE_DEVICE -RemoteFolderPath $DESTINATION_PATH -Verbose
    Write-Host "Registration succeeded." -ForegroundColor Green
}
catch {
    Write-Host "Registration failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Launching '$REMOTE_EXE' on $REMOTE_DEVICE ..."
try {
    $proc = Start-RitGame -RemoteDevice $REMOTE_DEVICE -RemotePath $REMOTE_EXE -Verbose
    Write-Host "Game launched: PID=$($proc.ProcessId) TID=$($proc.ThreadId)" -ForegroundColor Green
}
catch {
    Write-Host "Launch failed: $_" -ForegroundColor Red
    exit 1
}

#endregion
