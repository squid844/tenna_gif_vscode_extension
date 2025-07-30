const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');

let electronProcess;

function activate(context) {
    console.log('Tenna Dancer extension activated');

    // Enregistrement de la commande
    const startCommand = vscode.commands.registerCommand('tenna-dancer.start', () => {
        console.log('👉 Commande tenna-dancer.start déclenchée');
        launchElectron(context);
    });
    context.subscriptions.push(startCommand);

    // Lance automatiquement à l'activation
    launchElectron(context);

    // Sidebar Webview
    const provider = new TennaViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('tennaView', provider)
    );
}

function deactivate() {
    if (electronProcess) {
        electronProcess.kill();
        electronProcess = null;
    }
}

function launchElectron(context) {
    const electronBinary = process.platform === 'win32'
        ? path.join(context.extensionPath, 'node_modules', 'electron', 'dist', 'electron.exe')
        : path.join(context.extensionPath, 'node_modules', 'electron', 'dist', 'electron');

    const appPath = path.join(context.extensionPath, 'electron-app');
    const env = {...process.env};
    delete env.ELECTRON_RUN_AS_NODE;
    console.log('👉 launchElectron appelé');
    console.log('electronBinary:', electronBinary);

    try {
        electronProcess = spawn(electronBinary, ['.'], {
            cwd: appPath,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env
        });

        electronProcess.stdout.on('data', (data) => {
            console.log('Electron log:', data.toString());
        });

        electronProcess.stderr.on('data', (data) => {
            console.error('Electron error:', data.toString());
        });

        electronProcess.on('close', (code, signal) => {
            console.log(`Process Electron terminé avec code ${code} signal ${signal}`);
        });

        electronProcess.unref();
    } catch (error) {
        console.error("Erreur au lancement d'Electron :", error);
    }
}

class TennaViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView) {
        const webview = webviewView.webview;
        webview.options = { enableScripts: true };

        webview.html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; padding: 1em;">
                <h3>🎵 Tenna Settings</h3>
                <button id="change">Changer de danseur</button>
                <button id="stop">Arrêter</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('change').addEventListener('click', () => {
                        vscode.postMessage({ command: 'changeGif', name: 'tenna_2.gif' });
                    });
                    document.getElementById('stop').addEventListener('click', () => {
                        vscode.postMessage({ command: 'close' });
                    });
                </script>
            </body>
            </html>
        `;

        webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'changeGif':
                    vscode.window.showInformationMessage('Changement du gif : ' + message.name);
                    break;
                case 'close':
                    vscode.window.showInformationMessage('Fermeture demandée');
                    if (electronProcess) {
                        electronProcess.kill();
                        electronProcess = null;
                    }
                    break;
            }
        });
    }
}

module.exports = {
    activate,
    deactivate
};