'use strict';

/**
 * wdremoteapi.js - koffi projections for the Remote Iteration API.
 *
 * Adapted from the standalone Node.js sample. DLL loading is deferred via
 * loadLibrary(extensionPath) so the VS Code extension can supply the DLL
 * path at activation time rather than at require() time.
 *
 * All string parameters are UTF-8.
 */

const path  = require('path');
const koffi = require('koffi');

// ---------------------------------------------------------------------------
// Enums (plain frozen objects — no runtime type enforcement needed)
// ---------------------------------------------------------------------------

const WdCopyDirection     = Object.freeze({ CopyTo: 0, CopyFrom: 1 });
const WdCopyErrorSeverity = Object.freeze({ Warning: 0, Error: 1 });
const WdLaunchMode        = Object.freeze({ Immediate: 0, Suspended: 1 });

// ---------------------------------------------------------------------------
// Structs (defined once; independent of the DLL path)
// ---------------------------------------------------------------------------

// Controls copy direction and optional common root alias.
const WdCopyOptions = koffi.struct('WdCopyOptions', {
    copyDirection:   'uint32',
    commonRootAlias: 'str',
});

// File filter patterns and attribute flags.
const WdCopySearchOptions = koffi.struct('WdCopySearchOptions', {
    includeFilePattern:    'str',
    excludeFilePattern:    'str',
    excludeDirPattern:     'str',
    includeFileAttributes: 'uint64',
    excludeFileAttributes: 'uint64',
});

// Per-file progress snapshot delivered to the status callback.
const WdCopyFileProgressInfo = koffi.struct('WdCopyFileProgressInfo', {
    relativeFilePath: 'str',
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

// Callback prototypes
const WdCopyFilesStatusProto = koffi.proto(
    'int WdCopyFilesStatusCallback(' +
    'size_t count, WdCopyFileProgressInfo *updates, WdCopyOperationSummary *summary, void *ctx)'
);
const WdCopyErrorProto = koffi.proto(
    'int WdCopyErrorCallback(uint32 severity, str message, int error, void *ctx)'
);

// Bundles progress and error callbacks with a shared context pointer.
const WdCopyStatusCallbacks = koffi.struct('WdCopyStatusCallbacks', {
    copyFilesStatusCallback: koffi.pointer(WdCopyFilesStatusProto),
    refreshRateMs:           'uint32',
    copyErrorCallback:       koffi.pointer(WdCopyErrorProto),
    context:                 'void *',
});

// Controls how a remote game is launched.
const WdLaunchOptions = koffi.struct('WdLaunchOptions', {
    launchMode:      'uint32',
    commonRootAlias: 'str',
});

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
    const code  = hr >>> 0;
    const known = _WD_ERRORS[code];
    const hex   = '0x' + code.toString(16).toUpperCase().padStart(8, '0');
    return known ? `${hex} ${known}` : hex;
}

function checkHr(hr, fnName = 'API call') {
    if (FAILED(hr)) throw new Error(`${fnName} failed: ${hresultMessage(hr)}`);
    return hr;
}

// ---------------------------------------------------------------------------
// Library loading (deferred)
// ---------------------------------------------------------------------------

let _lib      = null;
let _dllPath  = null;

// Low-level function bindings (set by loadLibrary)
let _WdRemoteCopy              = null;
let _WdCancelRemoteCopy        = null;
let _WdCreateCancellationHandle  = null;
let _WdCloseCancellationHandle   = null;
let _WdDuplicateCancellationHandle = null;
let _WdLaunchRemoteGame        = null;
let _WdResumeRemoteGame        = null;
let _WdTerminateRemoteGame     = null;
let _WdRegisterRemoteXboxGame  = null;

/**
 * Load wdremoteapi.dll from the NuGet package bundled with the extension.
 * Must be called once during extension activation before creating WdRemoteApi.
 *
 * @param {string} extensionPath - The value of context.extensionPath from activate().
 */
function loadLibrary(extensionPath) {
    if (_lib) return; // already loaded

    const arch  = process.arch === 'arm64' ? 'arm64' : 'x64';
    _dllPath = path.join(
        extensionPath,
        'packages',
        'Microsoft.GDK.RemoteIterationClientApi.0.1.1-preview.26.3.27002',
        'native', 'windows', 'bin', arch, 'wdremoteapi.dll'
    );

    _lib = koffi.load(_dllPath);

    _WdCreateCancellationHandle = _lib.func(
        'int WdCreateCancellationHandle(void **handleOut)'
    );
    _WdCloseCancellationHandle = _lib.func(
        'void WdCloseCancellationHandle(void *handle)'
    );
    _WdDuplicateCancellationHandle = _lib.func(
        'int WdDuplicateCancellationHandle(void *handle, void **dupOut)'
    );
    _WdRemoteCopy = _lib.func(
        'int WdRemoteCopy(' +
        'str device, str source, str dest, ' +
        'WdCopyOptions *opts, WdCopySearchOptions *search, ' +
        'WdCopyStatusCallbacks *callbacks, void *cancellationHandle)'
    );
    _WdCancelRemoteCopy = _lib.func(
        'int WdCancelRemoteCopy(void *handle)'
    );
    _WdLaunchRemoteGame = _lib.func(
        'int WdLaunchRemoteGame(' +
        'str device, str remotePath, str args, ' +
        'WdLaunchOptions *opts, uint32 *processId, uint32 *threadId)'
    );
    _WdResumeRemoteGame = _lib.func(
        'int WdResumeRemoteGame(str device)'
    );
    _WdTerminateRemoteGame = _lib.func(
        'int WdTerminateRemoteGame(str device)'
    );
    _WdRegisterRemoteXboxGame = _lib.func(
        'int WdRegisterRemoteXboxGame(str device, str remoteFolderPath, str commonRootAlias)'
    );
}

// ---------------------------------------------------------------------------
// API wrapper class
// ---------------------------------------------------------------------------

class WdRemoteApi {
    _assertLoaded() {
        if (!_lib) throw new Error('Call loadLibrary(extensionPath) before using WdRemoteApi.');
    }

    WdRemoteCopy(device, source, dest, opts = null, search = null, callbacks = null) {
        this._assertLoaded();
        return _WdRemoteCopy(device, source, dest, opts, search, callbacks, null);
    }

    WdCancelRemoteCopy(handle) {
        this._assertLoaded();
        return _WdCancelRemoteCopy(handle);
    }

    WdLaunchRemoteGame(device, remotePath, args = null, opts = null) {
        this._assertLoaded();
        const pid = [0], tid = [0];
        const hr  = _WdLaunchRemoteGame(device, remotePath, args, opts, pid, tid);
        return { hr, processId: pid[0], threadId: tid[0] };
    }

    WdResumeRemoteGame(device) {
        this._assertLoaded();
        return _WdResumeRemoteGame(device);
    }

    WdTerminateRemoteGame(device) {
        this._assertLoaded();
        return _WdTerminateRemoteGame(device);
    }

    WdRegisterRemoteXboxGame(device, remoteFolderPath, commonRootAlias = null) {
        this._assertLoaded();
        return _WdRegisterRemoteXboxGame(device, remoteFolderPath, commonRootAlias);
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    loadLibrary,
    WdRemoteApi,
    WdCopyOptions,
    WdCopySearchOptions,
    WdCopyStatusCallbacks,
    WdCopyFileProgressInfo,
    WdCopyOperationSummary,
    WdLaunchOptions,
    WdCopyFilesStatusProto,
    WdCopyErrorProto,
    WdCopyDirection,
    WdCopyErrorSeverity,
    WdLaunchMode,
    FAILED,
    SUCCEEDED,
    hresultMessage,
    checkHr,
    get dllPath() { return _dllPath; },
};
