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

const { WdRemoteApi, checkHr, dllPath } = require('./wdremoteapi');

// ---------------------------------------------------------------------------
// Configuration — edit these values before running
// ---------------------------------------------------------------------------

const REMOTE_DEVICE    = '192.168.0.6';
const SOURCE_PATH      = String.raw`C:\rit\SimpleTriangleDesktop\Samples\IntroGraphics\SimpleTriangleDesktop\x64\Debug`;
const DESTINATION_PATH = 'SimpleTriangleDesktop';
const REMOTE_EXE_PATH  = String.raw`SimpleTriangleDesktop\SimpleTriangleDesktop.exe`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`DLL: ${dllPath}`);
const api = new WdRemoteApi();
console.log('DLL loaded successfully.\n');

console.log(`Remote device : ${REMOTE_DEVICE}`);
console.log(`Source        : ${SOURCE_PATH}`);
console.log(`Destination   : ${DESTINATION_PATH}`);

