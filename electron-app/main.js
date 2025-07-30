process.removeAllListeners('warning');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;
let currentGif = null; // on ne met plus de valeur par défaut

function createWindow() {
    win = new BrowserWindow({
        width: 120,
        height: 160,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    win.setMenuBarVisibility(false);
    win.loadFile('index.html');

    win.setAlwaysOnTop(true, 'normal');

    // On applique directement le GIF courant quand la fenêtre est prête
    win.webContents.on('did-finish-load', () => {
        if (currentGif) {
            win.webContents.send('update-gif', currentGif);
        }
    });

    // Écoute des commandes IPC internes (pas obligatoire ici mais on le garde)
    ipcMain.on('change-gif', (event, name) => {
        currentGif = name;
        if (win) {
            win.webContents.send('update-gif', currentGif);
        }
    });
}

// 🔹 Ecoute les commandes envoyées par l'extension (stdin)
process.stdin.on('data', (data) => {
    const message = data.toString().trim();

    // On reçoit une commande pour changer le GIF
    if (message.startsWith('CHANGE:')) {
        const newGif = message.replace('CHANGE:', '').trim();
        currentGif = newGif;

        // Si la fenêtre est déjà prête, on envoie le GIF tout de suite
        if (win) {
            win.webContents.send('update-gif', currentGif);
        }
    }
});

app.whenReady().then(() => {
    createWindow();

    // Si l'app est réactivée (macOS, etc.), on recrée une fenêtre
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Ferme proprement tout si on quitte
app.on('window-all-closed', () => {
    app.quit();
});