const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let dancers = []; // [{ id, process, gif }]
let providerInstance;

function activate(context) {
    console.log('Tenna Dancer extension activated');

    // Commande "Lancer Tenna Dancer"
    const startCommand = vscode.commands.registerCommand('tenna-dancer.start', () => {
        createDancerWithGif(context);
    });
    context.subscriptions.push(startCommand);

    // Lancement initial
    createDancerWithGif(context);

    // Sidebar
    providerInstance = new TennaViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('tennaView', providerInstance)
    );
}

function deactivate() {
    dancers.forEach(d => d.process.kill());
    dancers = [];
}

// 📂 Liste les GIFs disponibles dans le dossier gifs/
function listGifs() {
    const gifsPath = path.join(vscode.extensions.getExtension('votre-pseudo.tenna-dancer').extensionPath, 'electron-app', 'gifs');
    if (fs.existsSync(gifsPath)) {
        return fs.readdirSync(gifsPath).filter(file => /\.(gif|png|jpg)$/i.test(file));
    }
    return [];
}

// ➕ Ajoute un danseur avec choix du GIF
async function createDancerWithGif(context) {
    const gifs = listGifs();
    if (gifs.length === 0) {
        vscode.window.showErrorMessage('Aucun GIF trouvé. Ajoute d\'abord un GIF.');
        return;
    }

    // Menu pour choisir le GIF au lancement
    const selected = await vscode.window.showQuickPick(gifs, {
        placeHolder: 'Choisissez un GIF pour ce danseur'
    });

    if (selected) {
        addDancer(context, selected);
    }
}

// ➕ Lance le processus Electron pour un danseur
function addDancer(context, gifName) {
    const id = Date.now().toString();
    const electronBinary = process.platform === 'win32'
        ? path.join(context.extensionPath, 'node_modules', 'electron', 'dist', 'electron.exe')
        : path.join(context.extensionPath, 'node_modules', 'electron', 'dist', 'electron');

    const appPath = path.join(context.extensionPath, 'electron-app');

    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;

    try {
        const child = spawn(electronBinary, ['.'], {
            cwd: appPath,
            detached: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env
        });

        // On définit le GIF choisi pour ce danseur
        if (child.stdin.writable) {
            child.stdin.write(`CHANGE:${gifName}\n`);
        }

        child.on('close', () => {
            dancers = dancers.filter(d => d.id !== id);
            updateWebview();
        });

        child.unref();

        dancers.push({ id, process: child, gif: gifName });
        updateWebview();
    } catch (error) {
        console.error("Erreur au lancement d'Electron :", error);
    }
}

// 🔄 Change le GIF d’un danseur
function changeGif(id, newGif) {
    const dancer = dancers.find(d => d.id === id);
    if (dancer && dancer.process.stdin.writable) {
        dancer.gif = newGif; // mise à jour du nom
        dancer.process.stdin.write(`CHANGE:${newGif}\n`);
        updateWebview();
    }
}

// ❌ Supprime un danseur
function removeDancer(id) {
    const dancer = dancers.find(d => d.id === id);
    if (dancer) {
        dancer.process.kill();
        dancers = dancers.filter(d => d.id !== id);
        updateWebview();
    }
}

// ⛔ Arrête tous les danseurs
function stopAll() {
    dancers.forEach(d => d.process.kill());
    dancers = [];
    updateWebview();
}

// ➕ Ajouter un nouveau GIF
async function addGif() {
    const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { Images: ['gif', 'png', 'jpg'] }
    });
    if (uris && uris.length > 0) {
        const gifsPath = path.join(vscode.extensions.getExtension('votre-pseudo.tenna-dancer').extensionPath, 'electron-app', 'gifs');
        if (!fs.existsSync(gifsPath)) fs.mkdirSync(gifsPath, { recursive: true });
        const source = uris[0].fsPath;
        const dest = path.join(gifsPath, path.basename(source));
        fs.copyFileSync(source, dest);
        vscode.window.showInformationMessage(`GIF ajouté : ${path.basename(source)}`);
        updateWebview();
    }
}

// 🔹 Provider WebView
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
                case 'add': createDancerWithGif({ extensionPath: this._extensionUri.fsPath }); break;
                case 'stopAll': stopAll(); break;
                case 'changeGif': changeGif(message.id, message.gif); break;
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

// 🔄 Met à jour le panneau WebView
function updateWebview() {
    if (!providerInstance || !providerInstance._view) return;

    const gifs = listGifs();
    const gifsOptions = gifs.map(g => `<option class = "btn_small" value="${g}">${g}</option>`).join('');

    const dancersList = dancers.map(d => `
  <li style="margin-top: 5px; position: relative;">
    <span><strong>${d.gif}</strong></span>
    <div class="dropdown">
      <button class="btn_small dropdown-btn"> Change </button>
      <div class="dropdown-content">
        ${gifs.map(gif => `
          <div class="dropdown-item" onclick="changeGif('${d.id}', '${gif}')">${gif}</div>
        `).join('')}
      </div>
    </div>
    <button class="btn_small" onclick="remove('${d.id}')"> Remove</button>
  </li>
`).join('');

    const html = `
<!DOCTYPE html>
<html>
  <body>
    <h3> GIF Settings </h3>
    <button class="btn" onclick="add()">➕ Add a GIF to the screen</button>
    <button class="btn" onclick="stopAll()">🛑 Stop All GIFs</button>
    <button class="btn" onclick="addGif()">📂 Add a GIF to the folder</button>
    <ul>${dancers.map(d => `
      <li style="margin-top: 5px;">
        <span><strong>${d.gif}</strong></span>
        <div class="dropdown">
          <button class="btn_small dropdown-btn">🎬 Changer</button>
          <div class="dropdown-content">
            ${gifs.map(g => `
              <div class="dropdown-item" onclick="changeGif('${d.id}', '${g}')">${g}</div>
            `).join('')}
          </div>
        </div>
        <button class="btn_small" onclick="remove('${d.id}')">❌ Remove</button>
      </li>
    `).join('')}</ul>

    <style>
      body {
        font-family: arial, sans-serif;
        padding: 1em;
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
      }

      .btn, .btn_small {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: 2px solid;
        border-radius: 8px;
        padding: 5px 10px;
        margin: 3px;
        cursor: pointer;
      }

      .btn {
        width: 160px;
        height: 40px;
      }

      .btn_small {
        min-width: 80px;
        height: 30px;
      }

      .btn:hover, .btn_small:hover {
        background: var(--vscode-button-hoverBackground);
      }

      .dropdown {
        position: relative;
        display: inline-block;
      }

      .dropdown-content {
        display: none;
        position: absolute;
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-editorWidget-border);
        z-index: 10;
        min-width: 160px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }

      .dropdown-content .dropdown-item {
        color: var(--vscode-button-foreground);
        padding: 8px 12px;
        cursor: pointer;
      }

      .dropdown-content .dropdown-item:hover {
        background-color: var(--vscode-button-hoverBackground);
      }

      .dropdown:hover .dropdown-content {
        display: block;
      }
    </style>

    <script>
      const vscode = acquireVsCodeApi();
      function add() { vscode.postMessage({ command: 'add' }); }
      function stopAll() { vscode.postMessage({ command: 'stopAll' }); }
      function addGif() { vscode.postMessage({ command: 'addGif' }); }
      function remove(id) { vscode.postMessage({ command: 'remove', id }); }
      function changeGif(id, gif) {
        vscode.postMessage({ command: 'changeGif', id, gif });
      }
    </script>
  </body>
</html>
`;

    providerInstance.update(html);
}

module.exports = {
    activate,
    deactivate
};