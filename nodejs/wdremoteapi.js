'use strict';

/**
 * wdremoteapi.js - koffi projections for the Remote Iteration API.
 *
 * Maps structs, enums, callbacks, and function signatures from WdRemoteIteration.h
 * to koffi types. Require this module and use WdRemoteApi to call the API.
 *
 * The DLL (wdremoteapi.dll) is loaded automatically from the packages/ directory.
 * All string parameters are UTF-8.
 */

const path  = require('path');
const koffi = require('koffi');

// ---------------------------------------------------------------------------
// DLL loading
// ---------------------------------------------------------------------------

const _arch    = process.arch === 'arm64' ? 'arm64' : 'x64';
const _dllPath = path.resolve(
    __dirname, '..',
    'packages',
    'Microsoft.GDK.RemoteIterationClientApi.0.1.1-preview.26.3.27002',
    'native', 'windows', 'bin', _arch, 'wdremoteapi.dll'
);

const _lib = koffi.load(_dllPath);

// ---------------------------------------------------------------------------
// Enums (plain frozen objects — no runtime type enforcement needed)
// ---------------------------------------------------------------------------

const WdCopyDirection    = Object.freeze({ CopyTo: 0, CopyFrom: 1 });
const WdCopyErrorSeverity = Object.freeze({ Warning: 0, Error: 1 });
const WdLaunchMode       = Object.freeze({ Immediate: 0, Suspended: 1 });

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

// Controls copy direction and optional common root alias.
// uint32 copyDirection + 4 bytes implicit padding + pointer = 16 bytes on x64.
const WdCopyOptions = koffi.struct('WdCopyOptions', {
    copyDirection:   'uint32',
    commonRootAlias: 'str',    // const char* (UTF-8), or null
});

// File filter patterns and attribute flags. Pass null fields to include everything.
const WdCopySearchOptions = koffi.struct('WdCopySearchOptions', {
    includeFilePattern:    'str',     // semicolon-separated globs, or null
    excludeFilePattern:    'str',
    excludeDirPattern:     'str',
    includeFileAttributes: 'uint64',  // FILE_ATTRIBUTE_* flags; 0 = all
    excludeFileAttributes: 'uint64',  // FILE_ATTRIBUTE_* flags; 0 = none
});

// Per-file progress snapshot delivered to the status callback.
const WdCopyFileProgressInfo = koffi.struct('WdCopyFileProgressInfo', {
    relativeFilePath: 'str',    // UTF-8, relative to destination root
    sourcePath:       'str',
    destinationPath:  'str',
    bytesTransferred: 'uint64',
    fileSize:         'uint64',
});

// Overall progress summary delivered alongside per-file updates.
const WdCopyOperationSummary = koffi.struct('WdCopyOperationSummary', {
    filesCompletedCount:   'uint64',
    bytesTransferredCount: 'uint64',
    totalFileCount:        'uint64',
    totalByteCount:        'uint64',
});

// Callback prototype: called periodically during a copy with per-file and overall progress.
// Return a non-zero HRESULT to abort the copy.
const WdCopyFilesStatusProto = koffi.proto(
    'int WdCopyFilesStatusCallback(' +
    'size_t count, WdCopyFileProgressInfo *updates, WdCopyOperationSummary *summary, void *ctx)'
);

// Callback prototype: called when the copy emits a warning or error.
// Return a non-zero HRESULT to abort the copy.
const WdCopyErrorProto = koffi.proto(
    'int WdCopyErrorCallback(uint32 severity, str message, int error, void *ctx)'
);

// Bundles progress and error callbacks with a shared context pointer.
// Layout: fnptr(8) + uint32(4) + padding(4) + fnptr(8) + ptr(8) = 32 bytes on x64.
const WdCopyStatusCallbacks = koffi.struct('WdCopyStatusCallbacks', {
    copyFilesStatusCallback: koffi.pointer(WdCopyFilesStatusProto),
    refreshRateMs:           'uint32',   // 0 = default 500 ms
    copyErrorCallback:       koffi.pointer(WdCopyErrorProto),
    context:                 'void *',
});

// Controls how a remote game is launched.
// uint32 launchMode + 4 bytes implicit padding + pointer = 16 bytes on x64.
const WdLaunchOptions = koffi.struct('WdLaunchOptions', {
    launchMode:      'uint32',
    commonRootAlias: 'str',   // const char* (UTF-8), or null
});

// ---------------------------------------------------------------------------
// Function bindings
// ---------------------------------------------------------------------------

const _WdCreateCancellationHandle = _lib.func(
    'int WdCreateCancellationHandle(void **handleOut)'
);
const _WdCloseCancellationHandle = _lib.func(
    'void WdCloseCancellationHandle(void *handle)'
);
const _WdDuplicateCancellationHandle = _lib.func(
    'int WdDuplicateCancellationHandle(void *handle, void **dupOut)'
);

// Blocking. Only one WdRemoteCopy may be active at a time across all callers.
const _WdRemoteCopy = _lib.func(
    'int WdRemoteCopy(' +
    'str device, str source, str dest, ' +
    'WdCopyOptions *opts, WdCopySearchOptions *search, ' +
    'WdCopyStatusCallbacks *callbacks, void *cancellationHandle)'
);

// Thread-safe, non-blocking.
const _WdCancelRemoteCopy = _lib.func(
    'int WdCancelRemoteCopy(void *handle)'
);

const _WdLaunchRemoteGame = _lib.func(
    'int WdLaunchRemoteGame(' +
    'str device, str remotePath, str args, ' +
    'WdLaunchOptions *opts, uint32 *processId, uint32 *threadId)'
);
const _WdResumeRemoteGame = _lib.func(
    'int WdResumeRemoteGame(str device)'
);
const _WdTerminateRemoteGame = _lib.func(
    'int WdTerminateRemoteGame(str device)'
);
const _WdRegisterRemoteXboxGame = _lib.func(
    'int WdRegisterRemoteXboxGame(str device, str remoteFolderPath, str commonRootAlias)'
);

// ---------------------------------------------------------------------------
// HRESULT helpers
// ---------------------------------------------------------------------------

const _WD_ERRORS = {
    0x8C114008: 'E_CLIENTNOTAUTHORIZED: Device rejected this client. Complete PIN pairing first.',
    0x8C114009: 'E_SERVERNOTAUTHORIZED: Client rejected the device. Complete PIN pairing first.',
    0x8C114011: 'E_SERVERTOOOLD: Server version is too old. Update wdEndpoint on the remote device.',
    0x8C114012: 'E_NAMERESOLUTIONFAILED: Could not resolve the remote hostname.',
    0x8C114013: 'E_INVALIDADDRESS: Invalid or malformed address. Confirm the IP is correct.',
    0x8C114014: 'E_CONNECTIONERROR: Network connection failed. Check connectivity and firewall rules.',
    0x8C114016: 'E_ADMIN_REQUIRED: Administrator privileges required on the remote device.',
};

function FAILED(hr)    { return hr < 0; }
function SUCCEEDED(hr) { return hr >= 0; }

function hresultMessage(hr) {
    const code  = hr >>> 0;  // reinterpret signed int32 as uint32
    const known = _WD_ERRORS[code];
    const hex   = '0x' + code.toString(16).toUpperCase().padStart(8, '0');
    return known ? `${hex} ${known}` : hex;
}

function checkHr(hr, fnName = 'API call') {
    if (FAILED(hr)) throw new Error(`${fnName} failed: ${hresultMessage(hr)}`);
    return hr;
}

// ---------------------------------------------------------------------------
// API wrapper class
// ---------------------------------------------------------------------------

class WdRemoteApi {
    /** Copy a directory to or from a remote device. Blocking. */
    WdRemoteCopy(device, source, dest, opts = null, search = null, callbacks = null) {
        return _WdRemoteCopy(device, source, dest, opts, search, callbacks, null);
    }

    /** Cancel an in-progress WdRemoteCopy. Thread-safe, non-blocking. */
    WdCancelRemoteCopy(handle) {
        return _WdCancelRemoteCopy(handle);
    }

    /**
     * Launch a game executable on a remote device.
     * Returns { hr, processId, threadId }.
     */
    WdLaunchRemoteGame(device, remotePath, args = null, opts = null) {
        const pid = [0], tid = [0];
        const hr  = _WdLaunchRemoteGame(device, remotePath, args, opts, pid, tid);
        return { hr, processId: pid[0], threadId: tid[0] };
    }

    /** Resume a suspended game on a remote device. */
    WdResumeRemoteGame(device) {
        return _WdResumeRemoteGame(device);
    }

    /** Terminate the running game on a remote device. */
    WdTerminateRemoteGame(device) {
        return _WdTerminateRemoteGame(device);
    }

    /** Register an Xbox game on a remote device. */
    WdRegisterRemoteXboxGame(device, remoteFolderPath, commonRootAlias = null) {
        return _WdRegisterRemoteXboxGame(device, remoteFolderPath, commonRootAlias);
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    WdRemoteApi,
    // Struct types (pass instances to wrapper functions as optional parameters)
    WdCopyOptions,
    WdCopySearchOptions,
    WdCopyStatusCallbacks,
    WdCopyFileProgressInfo,
    WdCopyOperationSummary,
    WdLaunchOptions,
    // Callback prototypes (use with koffi.register() to create native callbacks)
    WdCopyFilesStatusProto,
    WdCopyErrorProto,
    // Enums
    WdCopyDirection,
    WdCopyErrorSeverity,
    WdLaunchMode,
    // HRESULT helpers
    FAILED,
    SUCCEEDED,
    hresultMessage,
    checkHr,
    // Resolved DLL path (useful for diagnostics)
    dllPath: _dllPath,
};
