// rit_sample.js - Remote Iteration API sample for Node.js
//
// Before running:
//   1. Set REMOTE_DEVICE to your Handheld's IP address or hostname.
//   2. Set SOURCE_PATH to the directory on this PC you want to copy.
//   3. Set DESTINATION_PATH to the destination path on the Handheld.
//   4. Set REMOTE_EXE_PATH to the executable path on the Handheld.
//
// Run with: node rit_sample.js

'use strict';

const koffi = require('koffi');
const {
    WdRemoteApi,
    WdCopyStatusCallbacks,
    WdCopyFilesStatusProto,
    WdCopyErrorProto,
    WdCopyErrorSeverity,
    checkHr,
    dllPath,
} = require('./wdremoteapi');

// ---------------------------------------------------------------------------
// Configuration — edit these values before running
// ---------------------------------------------------------------------------

const REMOTE_DEVICE    = '192.168.0.6';
const SOURCE_PATH      = String.raw`C:\rit\SimpleTriangleDesktop\Samples\IntroGraphics\SimpleTriangleDesktop\x64\Debug`;
const DESTINATION_PATH = 'SimpleTriangleDesktop';
const REMOTE_EXE_PATH  = String.raw`SimpleTriangleDesktop\SimpleTriangleDesktop.exe`;

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

function fmtBytes(n) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = Number(n);  // n may be a BigInt from koffi uint64
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
}

// koffi.register pins the JS function as a native callback for the duration
// of the copy. We hold the returned handles in module scope so they are not
// garbage-collected while WdRemoteCopy is running.
const _progressCallback = koffi.register(
    function onCopyProgress(count, updates, summary, _ctx) {
        const s        = summary[0];
        const total    = Number(s.totalByteCount);
        const done     = Number(s.bytesTransferredCount);
        const pct      = total > 0 ? done / total * 100 : 0;
        const filled   = Math.floor(pct / 100 * 40);
        const bar      = '#'.repeat(filled) + '-'.repeat(40 - filled);

        let active = '';
        if (count > 0) {
            const f    = updates[count - 1];
            const name = f.relativeFilePath || '';
            active     = `  ${name} (${fmtBytes(f.bytesTransferred)}/${fmtBytes(f.fileSize)})`;
        }

        const line = `\r[${bar}] ${pct.toFixed(1).padStart(5)}%  ` +
                     `${s.filesCompletedCount}/${s.totalFileCount} files  ` +
                     `${fmtBytes(done)}/${fmtBytes(total)}` +
                     active.padEnd(60);
        process.stdout.write(line);
        return 0;  // S_OK — continue the copy
    },
    koffi.pointer(WdCopyFilesStatusProto)
);

const _errorCallback = koffi.register(
    function onCopyError(severity, message, error, _ctx) {
        const label = severity === WdCopyErrorSeverity.Warning ? 'WARNING' : 'ERROR';
        const code  = (error >>> 0).toString(16).toUpperCase().padStart(8, '0');
        process.stdout.write(`\n[${label}] ${message} (hr=0x${code})\n`);
        return 0;  // S_OK — let the copy continue
    },
    koffi.pointer(WdCopyErrorProto)
);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`DLL: ${dllPath}`);
const api = new WdRemoteApi();
console.log('DLL loaded successfully.\n');

// ------------------------------------------------------------------
// Copy files to the Handheld
// ------------------------------------------------------------------
console.log(`Remote device : ${REMOTE_DEVICE}`);
console.log(`Source        : ${SOURCE_PATH}`);
console.log(`Destination   : ${DESTINATION_PATH}`);
console.log('\nStarting copy...');

const callbacks = {
    copyFilesStatusCallback: _progressCallback,
    refreshRateMs:           250,
    copyErrorCallback:       _errorCallback,
    context:                 null,
};

const copyHr = api.WdRemoteCopy(
    REMOTE_DEVICE, SOURCE_PATH, DESTINATION_PATH,
    null,       // copyOptions:   default (CopyTo, default root)
    null,       // searchOptions: copy all files
    callbacks,
);
process.stdout.write('\n');  // newline after the progress bar
checkHr(copyHr, 'WdRemoteCopy');
console.log('Copy completed successfully.\n');

// ------------------------------------------------------------------
// Launch the executable on the Handheld
// ------------------------------------------------------------------
console.log(`Launching      : ${REMOTE_EXE_PATH}`);
console.log(`On device      : ${REMOTE_DEVICE}`);

const { hr: launchHr, processId, threadId } = api.WdLaunchRemoteGame(
    REMOTE_DEVICE,
    REMOTE_EXE_PATH,
    null,   // no command-line arguments
    null,   // default launch options (Immediate mode)
);
checkHr(launchHr, 'WdLaunchRemoteGame');
console.log(`Launched successfully. PID=${processId}  TID=${threadId}`);


