const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let dancers = [];
let providerInstance;
let contextGlobal;

function activate(context) {
    contextGlobal = context;
    console.log('Tenna Dancer extension activated');

    context.subscriptions.push(
        vscode.commands.registerCommand('tenna-dancer.start', () => {
            createDancerWithGif();
        })
    );

    providerInstance = new TennaViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('tennaView', providerInstance)
    );

    // Lancement initial
    createDancerWithGif();
}

function deactivate() {
    dancers.forEach(d => d.process.kill());
    dancers = [];
}

function listGifs() {
    const gifsPath = path.join(contextGlobal.extensionPath, 'electron-app', 'gifs');
    if (fs.existsSync(gifsPath)) {
        return fs.readdirSync(gifsPath).filter(file => /\.(gif|png|jpg)$/i.test(file));
    }
    return [];
}

async function createDancerWithGif() {
    const gifs = listGifs();
    if (gifs.length === 0) {
        vscode.window.showErrorMessage('Aucun GIF trouvé. Ajoutez-en un d\'abord.');
        return;
    }

    const selected = await vscode.window.showQuickPick(gifs, {
        placeHolder: 'Choisissez un GIF'
    });

    if (selected) {
        addDancer(selected);
    }
}

function addDancer(gifName) {
    const id = Date.now().toString();
    const electronBinary = process.platform === 'win32'
        ? path.join(contextGlobal.extensionPath, 'node_modules', 'electron', 'dist', 'electron.exe')
        : path.join(contextGlobal.extensionPath, 'node_modules', 'electron', 'dist', 'electron');

    const appPath = path.join(contextGlobal.extensionPath, 'electron-app');

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;

    const child = spawn(electronBinary, ['main.js', id, gifName], {
        cwd: appPath,
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env
    });

    dancers.push({ id, process: child, gif: gifName });
    console.log(`🚶‍♂️ Danseur ${id} lancé avec ${gifName}`);
    updateWebview();
}

function removeDancer(id) {
    const dancer = dancers.find(d => d.id === id);
    if (dancer) {
        dancer.process.kill();
        dancers = dancers.filter(d => d.id !== id);
        updateWebview();
    }
}

function stopAll() {
    dancers.forEach(d => d.process.kill());
    dancers = [];
    updateWebview();
}

async function addGif() {
    const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { Images: ['gif', 'png', 'jpg'] }
    });

    if (uris && uris.length > 0) {
        const gifsPath = path.join(contextGlobal.extensionPath, 'electron-app', 'gifs');
        if (!fs.existsSync(gifsPath)) fs.mkdirSync(gifsPath, { recursive: true });
        const source = uris[0].fsPath;
        const dest = path.join(gifsPath, path.basename(source));
        fs.copyFileSync(source, dest);
        vscode.window.showInformationMessage(`GIF ajouté : ${path.basename(source)}`);
        updateWebview();
    }
}

class TennaViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this._view = null;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };

        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'add': createDancerWithGif(); break;
                case 'stopAll': stopAll(); break;
                case 'remove': removeDancer(message.id); break;
                case 'addGif': addGif(); break;
            }
        });

        updateWebview();
    }

    update(html) {
        if (this._view) {
            this._view.webview.html = html;
        }
    }
}

function updateWebview() {
    if (!providerInstance || !providerInstance._view) return;

    const html = `
<!DOCTYPE html>
<html>
  <body>
    <h3> GIF Settings </h3>
    <button class="btn" onclick="add()">➕ Add a GIF</button>
    <button class="btn" onclick="stopAll()">🛑 Stop All</button>
    <button class="btn" onclick="addGif()">📂 Add GIF to folder</button>
    <ul>${dancers.map(d => `
      <li style="margin-top: 5px;">
        <span><strong>${d.gif}</strong></span>
        <button class="btn_small" onclick="remove('${d.id}')">❌ Remove</button>
      </li>
    `).join('')}</ul>

    <style>
      body {
        font-family: sans-serif;
        padding: 1em;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
      }
      .btn, .btn_small {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: 2px solid;
        border-radius: 6px;
        margin: 4px;
        cursor: pointer;
      }
      .btn { padding: 8px 16px; min-width: 140px; }
      .btn_small { padding: 4px 8px; font-size: 12px; }
      .btn:hover, .btn_small:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>

    <script>
      const vscode = acquireVsCodeApi();
      function add() { vscode.postMessage({ command: 'add' }); }
      function stopAll() { vscode.postMessage({ command: 'stopAll' }); }
      function addGif() { vscode.postMessage({ command: 'addGif' }); }
      function remove(id) { vscode.postMessage({ command: 'remove', id }); }
    </script>
  </body>
</html>
`;

    providerInstance.update(html);
}

module.exports = { activate, deactivate };