import * as vscode from 'vscode';
import koffi, { IKoffiRegisteredCallback } from 'koffi';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rit = require('./wdremoteapi');

// ---------------------------------------------------------------------------
// Module-scope callback handles — must stay alive for the duration of a copy.
// ---------------------------------------------------------------------------
let _progressHandle: IKoffiRegisteredCallback | null = null;
let _errorHandle:    IKoffiRegisteredCallback | null = null;

// ---------------------------------------------------------------------------
// Output channel (one per extension lifetime)
// ---------------------------------------------------------------------------
let _output: vscode.OutputChannel;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig() {
    const cfg = vscode.workspace.getConfiguration('rit');
    return {
        device:      cfg.get<string>('remoteDevice',     ''),
        source:      cfg.get<string>('sourcePath',       ''),
        destination: cfg.get<string>('destinationPath',  ''),
        remoteExe:   cfg.get<string>('remoteExePath',    ''),
    };
}

function validateConfig(cfg: ReturnType<typeof getConfig>, needExe = false): string | null {
    if (!cfg.device)      return 'rit.remoteDevice is not set. Open Settings and fill it in.';
    if (!cfg.source)      return 'rit.sourcePath is not set.';
    if (!cfg.destination) return 'rit.destinationPath is not set.';
    if (needExe && !cfg.remoteExe) return 'rit.remoteExePath is not set.';
    return null;
}

function fmtBytes(n: number): string {
    if (n < 1024)            return `${n} B`;
    if (n < 1024 * 1024)     return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3)       return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// Deploy command
// ---------------------------------------------------------------------------

async function deployFiles(cfg: ReturnType<typeof getConfig>): Promise<void> {
    const api = new rit.WdRemoteApi();

    const copyOpts = new rit.WdCopyOptions();
    copyOpts.copyDirection   = rit.WdCopyDirection.CopyTo;
    copyOpts.commonRootAlias = null;

    return new Promise<void>((resolve, reject) => {
        // Register progress callback
        _progressHandle = koffi.register(
            (count: number, updatesPtr: unknown, summaryPtr: unknown) => {
                try {
                    const summary = koffi.decode(summaryPtr, rit.WdCopyOperationSummary);
                    const total   = Number(summary.totalByteCount);
                    const done    = Number(summary.bytesTransferredCount);
                    const pct     = total > 0 ? Math.round(done / total * 100) : 0;

                    // Log first file name in the batch
                    if (Number(count) > 0) {
                        const info = koffi.decode(updatesPtr, rit.WdCopyFileProgressInfo);
                        _output.appendLine(`  [${pct}%] ${info.relativeFilePath}  ${fmtBytes(done)} / ${fmtBytes(total)}`);
                    }
                } catch { /* non-fatal */ }
                return 0; // S_OK
            },
            koffi.pointer(rit.WdCopyFilesStatusProto)
        );

        // Register error callback
        _errorHandle = koffi.register(
            (severity: number, message: string, error: number) => {
                const tag = severity === rit.WdCopyErrorSeverity.Warning ? 'WARN' : 'ERR';
                _output.appendLine(`  [${tag}] ${message} (hr=0x${(error >>> 0).toString(16).toUpperCase()})`);
                return 0; // continue
            },
            koffi.pointer(rit.WdCopyErrorProto)
        );

        const callbacks = new rit.WdCopyStatusCallbacks();
        callbacks.copyFilesStatusCallback = _progressHandle;
        callbacks.refreshRateMs           = 250;
        callbacks.copyErrorCallback       = _errorHandle;
        callbacks.context                 = null;

        // WdRemoteCopy is blocking — run on a background thread via setImmediate
        // so the VS Code UI stays responsive.
        setImmediate(() => {
            try {
                const hr = api.WdRemoteCopy(
                    cfg.device, cfg.source, cfg.destination,
                    copyOpts, null, callbacks
                );
                if (rit.FAILED(hr)) {
                    reject(new Error(`WdRemoteCopy failed: ${rit.hresultMessage(hr)}`));
                } else {
                    resolve();
                }
            } catch (e) {
                reject(e);
            } finally {
                if (_progressHandle) koffi.unregister(_progressHandle);
                if (_errorHandle)    koffi.unregister(_errorHandle);
                _progressHandle = null;
                _errorHandle    = null;
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Launch command
// ---------------------------------------------------------------------------

function launchGame(cfg: ReturnType<typeof getConfig>): void {
    const api = new rit.WdRemoteApi();
    const launchOpts = new rit.WdLaunchOptions();
    launchOpts.launchMode      = rit.WdLaunchMode.Immediate;
    launchOpts.commonRootAlias = null;

    const { hr, processId, threadId } = api.WdLaunchRemoteGame(
        cfg.device, cfg.remoteExe, null, launchOpts
    );

    if (rit.FAILED(hr)) {
        throw new Error(`WdLaunchRemoteGame failed: ${rit.hresultMessage(hr)}`);
    }

    _output.appendLine(`Launched: PID=${processId}  TID=${threadId}`);
}

// ---------------------------------------------------------------------------
// Extension lifecycle
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
    _output = vscode.window.createOutputChannel('Remote Iteration');
    context.subscriptions.push(_output);

    // Load the native DLL now that we have extensionPath.
    try {
        rit.loadLibrary(context.extensionPath);
        _output.appendLine(`DLL loaded: ${rit.dllPath}`);
    } catch (e) {
        vscode.window.showErrorMessage(`Remote Iteration Tools: Failed to load DLL — ${e}`);
        return;
    }

    // rit.deploy
    context.subscriptions.push(
        vscode.commands.registerCommand('rit.deploy', async () => {
            const cfg = getConfig();
            const err = validateConfig(cfg);
            if (err) { vscode.window.showErrorMessage(err); return; }

            _output.show(true);
            _output.appendLine(`\nDeploying ${cfg.source} → ${cfg.device}:${cfg.destination}`);

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'RIT: Deploying…', cancellable: false },
                async () => {
                    try {
                        await deployFiles(cfg);
                        _output.appendLine('Deploy complete.');
                        vscode.window.showInformationMessage('RIT: Deploy complete.');
                    } catch (e) {
                        _output.appendLine(`Deploy failed: ${e}`);
                        vscode.window.showErrorMessage(`RIT Deploy failed: ${e}`);
                    }
                }
            );
        })
    );

    // rit.launch
    context.subscriptions.push(
        vscode.commands.registerCommand('rit.launch', () => {
            const cfg = getConfig();
            const err = validateConfig(cfg, true);
            if (err) { vscode.window.showErrorMessage(err); return; }

            _output.show(true);
            _output.appendLine(`\nLaunching ${cfg.remoteExe} on ${cfg.device}`);

            try {
                launchGame(cfg);
                vscode.window.showInformationMessage('RIT: Game launched.');
            } catch (e) {
                _output.appendLine(`Launch failed: ${e}`);
                vscode.window.showErrorMessage(`RIT Launch failed: ${e}`);
            }
        })
    );

    // rit.deployAndLaunch
    context.subscriptions.push(
        vscode.commands.registerCommand('rit.deployAndLaunch', async () => {
            const cfg = getConfig();
            const err = validateConfig(cfg, true);
            if (err) { vscode.window.showErrorMessage(err); return; }

            _output.show(true);
            _output.appendLine(`\nDeploy + Launch: ${cfg.source} → ${cfg.device}:${cfg.destination}`);

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'RIT: Deploying…', cancellable: false },
                async () => {
                    try {
                        await deployFiles(cfg);
                        _output.appendLine('Deploy complete. Launching…');
                        launchGame(cfg);
                        vscode.window.showInformationMessage('RIT: Deploy and Launch complete.');
                    } catch (e) {
                        _output.appendLine(`Failed: ${e}`);
                        vscode.window.showErrorMessage(`RIT failed: ${e}`);
                    }
                }
            );
        })
    );
}

export function deactivate(): void {
    // Clean up any lingering callback handles (shouldn't happen in normal flow)
    if (_progressHandle) { try { koffi.unregister(_progressHandle); } catch { /* ignore */ } }
    if (_errorHandle)    { try { koffi.unregister(_errorHandle); }    catch { /* ignore */ } }
}
