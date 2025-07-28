const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');

let electronProcess;

function activate(context) {
    console.log('Tenna Dancer extension activated');

    // Commande manuelle
    const startCommand = vscode.commands.registerCommand('tenna-dancer.start', () => {
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
    }
}

function launchElectron(context) {
    const electronPath = path.join(
        context.extensionPath,
        'electron-app',
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'electron.cmd' : 'electron'
    );

    const appPath = path.join(context.extensionPath, 'electron-app');

    try {
        electronProcess = spawn(electronPath, ['.'], {
            cwd: appPath,
            detached: false,           // ne détache pas pour pouvoir voir le process
            stdio: 'inherit',          // affiche stdout/stderr dans la console VSCode
            shell: process.platform === 'win32'
        });

        electronProcess.on('error', (err) => {
            console.error('Erreur spawn Electron:', err);
        });

        electronProcess.on('exit', (code, signal) => {
            console.log(`Process Electron terminé avec code ${code} signal ${signal}`);
        });
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
                    // TODO: envoyer le message à Electron si souhaité
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