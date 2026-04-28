# RitApi.psm1 - PowerShell module for the Remote Iteration API.
#
# Wraps wdremoteapi.dll via inline C# P/Invoke compiled at module load with Add-Type.
# All API strings are UTF-8 (const char*); marshaling is handled internally.
#
# The DLL is resolved from the packages/ directory in this repository.
# Only Windows x64 and ARM64 are supported.
#
# Exported functions:
#   Copy-RitFiles      - Deploy a directory to (or from) a remote device
#   Start-RitGame      - Launch a game executable on a remote device
#   Stop-RitGame       - Terminate the running game on a remote device
#   Resume-RitGame     - Resume a suspended game on a remote device
#   Register-RitGame   - Register an Xbox game on a remote device

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region --- Platform and DLL Validation ---

if (-not [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
        [System.Runtime.InteropServices.OSPlatform]::Windows)) {
    throw 'RitApi requires Windows.'
}

$arch = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture
$archDir = switch ($arch) {
    'X64'   { 'x64' }
    'Arm64' { 'arm64' }
    default { throw "RitApi: unsupported architecture '$arch'. Only X64 and Arm64 are supported." }
}

$script:DllPath = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\packages\Microsoft.GDK.RemoteIterationClientApi.0.1.1-preview.26.3.27002\native\windows\bin\$archDir\wdremoteapi.dll"))

if (-not (Test-Path $script:DllPath)) {
    throw "wdremoteapi.dll not found at: $script:DllPath`nEnsure the NuGet package is present in the packages/ directory."
}

# Pre-load the native DLL so that DllImport("wdremoteapi.dll") resolves by name.
[System.Runtime.InteropServices.NativeLibrary]::Load($script:DllPath) | Out-Null

#endregion

#region --- C# Type Definitions ---

$CSharpCode = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace RitApi {

    public enum WdCopyDirection : uint { CopyTo = 0, CopyFrom = 1 }
    public enum WdLaunchMode    : uint { Immediate = 0, Suspended = 1 }

    // Structs mirror the C layout. LayoutKind.Sequential with Pack=0 adds implicit
    // alignment padding on x64 (e.g., 4 bytes between a uint and the following IntPtr).
    // Size assertions in WdNative.AssertLayout() verify correctness at runtime.

    [StructLayout(LayoutKind.Sequential)]
    public struct WdCopyOptions {
        public uint   copyDirection;    // WdCopyDirection; 4 bytes + 4 implicit padding
        public IntPtr commonRootAlias;  // UTF-8 const char*, or Zero
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WdCopySearchOptions {
        public IntPtr includeFilePattern;    // UTF-8, semicolon-separated globs, or Zero
        public IntPtr excludeFilePattern;
        public IntPtr excludeDirPattern;
        public ulong  includeFileAttributes; // FILE_ATTRIBUTE_* flags; 0 = all
        public ulong  excludeFileAttributes; // FILE_ATTRIBUTE_* flags; 0 = none
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WdCopyStatusCallbacks {
        public IntPtr copyFilesStatusCallback; // fn ptr; 8 bytes + uint below + 4 implicit padding
        public uint   refreshRateMs;           // 0 = default 500 ms
        public IntPtr copyErrorCallback;       // fn ptr, or Zero
        public IntPtr context;                 // user context, or Zero
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WdLaunchOptions {
        public uint   launchMode;      // WdLaunchMode; 4 bytes + 4 implicit padding
        public IntPtr commonRootAlias; // UTF-8 const char*, or Zero
    }

    public static class WdNative {

        // Only one WdRemoteCopy may be active at a time across all callers.
        private static readonly SemaphoreSlim s_copySemaphore = new SemaphoreSlim(1, 1);

        // Verifies that C# struct sizes match the C struct layout.
        // Call once at module initialization to catch layout mismatches early.
        public static void AssertLayout() {
            void Check(int actual, int expected, string name) {
                if (actual != expected)
                    throw new InvalidOperationException(
                        $"Struct layout mismatch for {name}: expected {expected} bytes, got {actual}. " +
                        "This is a bug in RitApi.psm1.");
            }
            Check(Marshal.SizeOf<WdCopyOptions>(),        16, "WdCopyOptions");
            Check(Marshal.SizeOf<WdCopySearchOptions>(),  40, "WdCopySearchOptions");
            Check(Marshal.SizeOf<WdCopyStatusCallbacks>(), 32, "WdCopyStatusCallbacks");
            Check(Marshal.SizeOf<WdLaunchOptions>(),      16, "WdLaunchOptions");
        }

        // WdRemoteCopy is blocking. Serialize all calls via a semaphore.
        public static int RemoteCopy(
            string device, string source, string destination,
            IntPtr copyOptions, IntPtr searchOptions, IntPtr callbacks)
        {
            s_copySemaphore.Wait();
            try {
                return WdRemoteCopyRaw(device, source, destination,
                    copyOptions, searchOptions, callbacks, IntPtr.Zero);
            } finally {
                s_copySemaphore.Release();
            }
        }

        [DllImport("wdremoteapi.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "WdRemoteCopy")]
        private static extern int WdRemoteCopyRaw(
            [MarshalAs(UnmanagedType.LPUTF8Str)] string device,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string source,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string destination,
            IntPtr copyOptions,
            IntPtr searchOptions,
            IntPtr statusCallbacks,
            IntPtr cancellationHandle);

        [DllImport("wdremoteapi.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int WdLaunchRemoteGame(
            [MarshalAs(UnmanagedType.LPUTF8Str)] string device,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string remotePath,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string args,
            IntPtr launchOptions,
            out uint processId,
            out uint threadId);

        [DllImport("wdremoteapi.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int WdResumeRemoteGame(
            [MarshalAs(UnmanagedType.LPUTF8Str)] string device);

        [DllImport("wdremoteapi.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int WdTerminateRemoteGame(
            [MarshalAs(UnmanagedType.LPUTF8Str)] string device);

        [DllImport("wdremoteapi.dll", CallingConvention = CallingConvention.Cdecl)]
        public static extern int WdRegisterRemoteXboxGame(
            [MarshalAs(UnmanagedType.LPUTF8Str)] string device,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string remoteFolderPath,
            [MarshalAs(UnmanagedType.LPUTF8Str)] string commonRootAlias);
    }

    // Helpers that allocate unmanaged structs for optional pointer parameters.
    // Each Alloc* method returns an IntPtr to pass to WdNative.
    // Always call the matching Free* in a finally block to prevent leaks.
    public static class StructAlloc {

        public static IntPtr AllocCopyOptions(uint direction, string alias) {
            int size = Marshal.SizeOf<WdCopyOptions>();
            IntPtr ptr = Alloc(size);
            try {
                var s = new WdCopyOptions {
                    copyDirection   = direction,
                    commonRootAlias = alias != null ? Marshal.StringToCoTaskMemUTF8(alias) : IntPtr.Zero
                };
                Marshal.StructureToPtr(s, ptr, false);
                return ptr;
            } catch {
                Marshal.FreeHGlobal(ptr);
                throw;
            }
        }

        public static void FreeCopyOptions(IntPtr ptr) {
            if (ptr == IntPtr.Zero) return;
            var s = Marshal.PtrToStructure<WdCopyOptions>(ptr);
            if (s.commonRootAlias != IntPtr.Zero) Marshal.FreeCoTaskMem(s.commonRootAlias);
            Marshal.FreeHGlobal(ptr);
        }

        public static IntPtr AllocSearchOptions(string include, string exclude, string excludeDir) {
            int size = Marshal.SizeOf<WdCopySearchOptions>();
            IntPtr ptr = Alloc(size);
            var s = new WdCopySearchOptions();
            try {
                s.includeFilePattern = include     != null ? Marshal.StringToCoTaskMemUTF8(include)     : IntPtr.Zero;
                s.excludeFilePattern = exclude     != null ? Marshal.StringToCoTaskMemUTF8(exclude)     : IntPtr.Zero;
                s.excludeDirPattern  = excludeDir  != null ? Marshal.StringToCoTaskMemUTF8(excludeDir)  : IntPtr.Zero;
                Marshal.StructureToPtr(s, ptr, false);
                return ptr;
            } catch {
                if (s.includeFilePattern != IntPtr.Zero) Marshal.FreeCoTaskMem(s.includeFilePattern);
                if (s.excludeFilePattern != IntPtr.Zero) Marshal.FreeCoTaskMem(s.excludeFilePattern);
                if (s.excludeDirPattern  != IntPtr.Zero) Marshal.FreeCoTaskMem(s.excludeDirPattern);
                Marshal.FreeHGlobal(ptr);
                throw;
            }
        }

        public static void FreeSearchOptions(IntPtr ptr) {
            if (ptr == IntPtr.Zero) return;
            var s = Marshal.PtrToStructure<WdCopySearchOptions>(ptr);
            if (s.includeFilePattern != IntPtr.Zero) Marshal.FreeCoTaskMem(s.includeFilePattern);
            if (s.excludeFilePattern != IntPtr.Zero) Marshal.FreeCoTaskMem(s.excludeFilePattern);
            if (s.excludeDirPattern  != IntPtr.Zero) Marshal.FreeCoTaskMem(s.excludeDirPattern);
            Marshal.FreeHGlobal(ptr);
        }

        public static IntPtr AllocLaunchOptions(uint mode, string alias) {
            int size = Marshal.SizeOf<WdLaunchOptions>();
            IntPtr ptr = Alloc(size);
            try {
                var s = new WdLaunchOptions {
                    launchMode      = mode,
                    commonRootAlias = alias != null ? Marshal.StringToCoTaskMemUTF8(alias) : IntPtr.Zero
                };
                Marshal.StructureToPtr(s, ptr, false);
                return ptr;
            } catch {
                Marshal.FreeHGlobal(ptr);
                throw;
            }
        }

        public static void FreeLaunchOptions(IntPtr ptr) {
            if (ptr == IntPtr.Zero) return;
            var s = Marshal.PtrToStructure<WdLaunchOptions>(ptr);
            if (s.commonRootAlias != IntPtr.Zero) Marshal.FreeCoTaskMem(s.commonRootAlias);
            Marshal.FreeHGlobal(ptr);
        }

        // Zero-initialized allocation so padding bytes in structs are always 0.
        private static IntPtr Alloc(int size) {
            IntPtr ptr = Marshal.AllocHGlobal(size);
            Marshal.Copy(new byte[size], 0, ptr, size);
            return ptr;
        }
    }
}
'@

if (-not ([System.Management.Automation.PSTypeName]'RitApi.WdNative').Type) {
    Add-Type -TypeDefinition $CSharpCode
}

[RitApi.WdNative]::AssertLayout()

#endregion

#region --- HRESULT Helpers ---

# Error codes sourced from WdRemoteIteration.h and HResultHelper.cs in the C# reference sample.
# Keys are 8-digit uppercase hex strings (without 0x prefix) to avoid PS signed-integer literal issues.
$script:HResultMessages = @{
    '8C114001' = 'E_OUTSIDEGAMEROOT: Path lies outside of the common root.'
    '8C114002' = 'E_PROCESSNOTFOUND: The remote process was not found.'
    '8C114003' = 'E_INVALIDPROCESSID: The process ID is invalid.'
    '8C114004' = 'E_INVALIDPIN: The device rejected the PIN. Try re-pairing.'
    '8C114005' = 'E_INVALIDSSHKEY: The device rejected the SSH key.'
    '8C114006' = 'E_PAIRINGTIMEOUT: Pairing timed out. Please try again.'
    '8C114007' = 'E_TOOMANYFAILURES: Too many failed attempts. Restart wdendpoint.exe on the remote device.'
    '8C114008' = 'E_CLIENTNOTAUTHORIZED: This PC is not authorized. Try re-pairing.'
    '8C114009' = 'E_SERVERNOTAUTHORIZED: The remote device could not be verified. Try re-pairing.'
    '8C11400A' = 'E_SSHKEYTOOLARGE: The SSH key file is too large.'
    '8C11400B' = 'E_GAMENOTSUSPENDED: The game is not suspended.'
    '8C11400C' = 'E_GAMENOTRUNNING: No game is running on the remote device.'
    '8C11400D' = 'E_GAMEOVERSUSPENDED: The game was not resumed; too many suspend counts.'
    '8C11400E' = 'E_GAMESTILLRUNNING: A game is already running on the remote device.'
    '8C114010' = 'E_GAMEFILEPATHNOTEXIST: The game file path does not exist on the remote device.'
    '8C114011' = 'E_SERVERTOOOLD: wdendpoint.exe is too old. Please update it on the remote device.'
    '8C114012' = 'E_NAMERESOLUTIONFAILED: Could not resolve the remote device name. Check DNS or use an IP.'
    '8C114014' = 'E_CONNECTIONERROR: Network connection failed. Check connectivity and firewall rules.'
    '8C11401A' = 'E_ENDPOINTUPGRADEREQUIRED: wdendpoint.exe must be upgraded before this operation can proceed.'
    '8C11401B' = 'E_ENDPOINTUPGRADERECOMMENDED: wdendpoint.exe should be upgraded to a newer version.'
    '8C11401C' = 'E_CLIENTUPGRADERECOMMENDED: A newer version of wdremote.exe is recommended.'
    '80072EFD' = 'WINHTTP_CANNOT_CONNECT: Could not connect. Verify the remote device is reachable.'
    '80072EE7' = 'WINHTTP_NAME_NOT_RESOLVED: Could not resolve the device name. Verify it is correct.'
    '80072EE2' = 'WINHTTP_TIMEOUT: Connection timed out.'
    '80072EFE' = 'WINHTTP_CONNECTION_ERROR: Connection was interrupted.'
}

function Get-HResultMessage {
    param([int]$HResult)
    # Convert signed Int32 HRESULT to unsigned hex string for hashtable lookup.
    $uval = if ($HResult -lt 0) { [uint32]([int64]$HResult + 4294967296L) } else { [uint32]$HResult }
    $key  = '{0:X8}' -f $uval
    $known = $script:HResultMessages[$key]
    if ($known) {
        return "0x$key $known"
    }
    # Fall back to the .NET exception message for well-known COM/Win32 codes.
    $exMsg = ([System.Runtime.InteropServices.Marshal]::GetExceptionForHR($HResult))?.Message
    if ($exMsg) {
        return "0x$key ($exMsg)"
    }
    return "0x$key"
}

function Assert-HResult {
    param([int]$HResult, [string]$Operation = 'API call')
    if ($HResult -lt 0) {
        throw "$Operation failed: $(Get-HResultMessage $HResult)"
    }
}

#endregion

#region --- Public Functions ---

function Copy-RitFiles {
    <#
    .SYNOPSIS
        Copies a directory to (or from) a remote device using WdRemoteCopy.
    .DESCRIPTION
        Calls WdRemoteCopy to transfer a local directory to the specified remote device.
        This is a blocking call that returns when the copy completes or fails.
        Only one copy operation may be active at a time; concurrent calls block until the
        previous one completes.
    .PARAMETER RemoteDevice
        IP address or hostname of the remote device.
    .PARAMETER SourcePath
        Source directory (local for CopyTo, remote for CopyFrom).
    .PARAMETER DestinationPath
        Destination path (remote for CopyTo, local for CopyFrom). May be a relative path
        resolved against the common root on the remote device.
    .PARAMETER Direction
        CopyTo (default) copies files to the device; CopyFrom copies files from it.
    .PARAMETER CommonRootAlias
        Optional alias for a pre-configured common root directory on the remote device.
        Ignored when DestinationPath is an absolute path.
    .PARAMETER IncludeFilePattern
        Semicolon-separated file patterns to include (e.g. "*.exe;*.dll"). Default: all files.
    .PARAMETER ExcludeFilePattern
        Semicolon-separated file patterns to exclude.
    .PARAMETER ExcludeDirPattern
        Semicolon-separated directory name patterns to exclude.
    .EXAMPLE
        Copy-RitFiles -RemoteDevice "192.168.1.10" -SourcePath "C:\MyGame" -DestinationPath "MyGame"
    .EXAMPLE
        Copy-RitFiles -RemoteDevice "192.168.1.10" -SourcePath "C:\MyGame" -DestinationPath "MyGame" `
            -IncludeFilePattern "*.exe;*.dll" -ExcludeDirPattern "debug;temp"
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RemoteDevice,
        [Parameter(Mandatory)][string]$SourcePath,
        [Parameter(Mandatory)][string]$DestinationPath,
        [ValidateSet('CopyTo', 'CopyFrom')]
        [string]$Direction = 'CopyTo',
        [string]$CommonRootAlias,
        [string]$IncludeFilePattern,
        [string]$ExcludeFilePattern,
        [string]$ExcludeDirPattern
    )

    $copyOptsPtr   = [IntPtr]::Zero
    $searchOptsPtr = [IntPtr]::Zero

    try {
        if ($Direction -eq 'CopyFrom' -or $CommonRootAlias) {
            $dir = if ($Direction -eq 'CopyFrom') { [uint32]1 } else { [uint32]0 }
            $copyOptsPtr = [RitApi.StructAlloc]::AllocCopyOptions($dir, $CommonRootAlias)
        }

        if ($IncludeFilePattern -or $ExcludeFilePattern -or $ExcludeDirPattern) {
            $searchOptsPtr = [RitApi.StructAlloc]::AllocSearchOptions(
                $IncludeFilePattern, $ExcludeFilePattern, $ExcludeDirPattern)
        }

        Write-Verbose "Copying '$SourcePath' -> ${RemoteDevice}:'$DestinationPath' ..."
        $hr = [RitApi.WdNative]::RemoteCopy(
            $RemoteDevice, $SourcePath, $DestinationPath,
            $copyOptsPtr, $searchOptsPtr, [IntPtr]::Zero)

        Assert-HResult $hr 'Copy-RitFiles'
        Write-Verbose 'Copy completed successfully.'
    }
    finally {
        [RitApi.StructAlloc]::FreeCopyOptions($copyOptsPtr)
        [RitApi.StructAlloc]::FreeSearchOptions($searchOptsPtr)
    }
}

function Start-RitGame {
    <#
    .SYNOPSIS
        Launches a game executable on a remote device.
    .PARAMETER RemoteDevice
        IP address or hostname of the remote device.
    .PARAMETER RemotePath
        Path to the game executable on the remote device. May be relative to the common root.
    .PARAMETER Arguments
        Optional command-line arguments to pass to the game.
    .PARAMETER Suspended
        If specified, launches the game in a suspended state (use Resume-RitGame to start it).
    .PARAMETER CommonRootAlias
        Optional alias for a pre-configured common root directory on the remote device.
    .OUTPUTS
        PSCustomObject with ProcessId and ThreadId of the launched game process.
    .EXAMPLE
        $proc = Start-RitGame -RemoteDevice "192.168.1.10" -RemotePath "MyGame\game.exe"
        Write-Host "Launched PID $($proc.ProcessId)"
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RemoteDevice,
        [Parameter(Mandatory)][string]$RemotePath,
        [string]$Arguments,
        [switch]$Suspended,
        [string]$CommonRootAlias
    )

    $launchOptsPtr = [IntPtr]::Zero

    try {
        if ($Suspended -or $CommonRootAlias) {
            $mode = if ($Suspended) { [uint32]1 } else { [uint32]0 }
            $launchOptsPtr = [RitApi.StructAlloc]::AllocLaunchOptions($mode, $CommonRootAlias)
        }

        $pid = [uint32]0
        $tid = [uint32]0

        Write-Verbose "Launching '$RemotePath' on $RemoteDevice ..."
        $hr = [RitApi.WdNative]::WdLaunchRemoteGame(
            $RemoteDevice, $RemotePath,
            $(if ($Arguments) { $Arguments } else { $null }),
            $launchOptsPtr,
            [ref]$pid, [ref]$tid)

        Assert-HResult $hr 'Start-RitGame'
        Write-Verbose "Launched: PID=$pid TID=$tid"

        [PSCustomObject]@{
            ProcessId = $pid
            ThreadId  = $tid
        }
    }
    finally {
        [RitApi.StructAlloc]::FreeLaunchOptions($launchOptsPtr)
    }
}

function Stop-RitGame {
    <#
    .SYNOPSIS
        Terminates the running game on a remote device.
    .PARAMETER RemoteDevice
        IP address or hostname of the remote device.
    .EXAMPLE
        Stop-RitGame -RemoteDevice "192.168.1.10"
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RemoteDevice)

    Write-Verbose "Terminating game on $RemoteDevice ..."
    $hr = [RitApi.WdNative]::WdTerminateRemoteGame($RemoteDevice)
    Assert-HResult $hr 'Stop-RitGame'
    Write-Verbose 'Game terminated.'
}

function Resume-RitGame {
    <#
    .SYNOPSIS
        Resumes a game launched in suspended state on a remote device.
    .PARAMETER RemoteDevice
        IP address or hostname of the remote device.
    .EXAMPLE
        Resume-RitGame -RemoteDevice "192.168.1.10"
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$RemoteDevice)

    Write-Verbose "Resuming game on $RemoteDevice ..."
    $hr = [RitApi.WdNative]::WdResumeRemoteGame($RemoteDevice)
    Assert-HResult $hr 'Resume-RitGame'
    Write-Verbose 'Game resumed.'
}

function Register-RitGame {
    <#
    .SYNOPSIS
        Registers an Xbox game on a remote device.
    .PARAMETER RemoteDevice
        IP address or hostname of the remote device.
    .PARAMETER RemoteFolderPath
        Path to the game folder on the remote device. May be relative to the common root.
    .PARAMETER CommonRootAlias
        Optional alias for a pre-configured common root directory. Ignored if RemoteFolderPath
        is an absolute path.
    .EXAMPLE
        Register-RitGame -RemoteDevice "192.168.1.10" -RemoteFolderPath "MyGame"
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RemoteDevice,
        [Parameter(Mandatory)][string]$RemoteFolderPath,
        [string]$CommonRootAlias
    )

    Write-Verbose "Registering game '$RemoteFolderPath' on $RemoteDevice ..."
    $hr = [RitApi.WdNative]::WdRegisterRemoteXboxGame(
        $RemoteDevice,
        $RemoteFolderPath,
        $(if ($CommonRootAlias) { $CommonRootAlias } else { $null }))

    Assert-HResult $hr 'Register-RitGame'
    Write-Verbose 'Game registered.'
}

#endregion

Export-ModuleMember -Function Copy-RitFiles, Start-RitGame, Stop-RitGame, Resume-RitGame, Register-RitGame
