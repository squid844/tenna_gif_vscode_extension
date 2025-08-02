const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

let win;
let currentGif = null;
let tmpPath = null;

const [,, dancerId, gifName] = process.argv;

if (dancerId && gifName) {
    currentGif = gifName;
    tmpPath = path.join(os.tmpdir(), `tenna-dancer-${dancerId}.json`);
}

function createWindow() {
    win = new BrowserWindow({
        width: 140,
        height: 140,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        hasShadow: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    win.setMenuBarVisibility(false);
    win.loadFile('index.html');

    win.webContents.on('did-finish-load', () => {
        if (currentGif) {
            win.webContents.send('update-gif', currentGif);
        }
    });

    ipcMain.on('change-gif', (event, newGif) => {
        currentGif = newGif;
        win.webContents.send('update-gif', currentGif);
    });
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.startsWith('CHANGE:')) {
        const newGif = msg.split(':')[1];
        console.log('🔁 Changement demandé vers:', newGif);
        if (win && win.webContents) {
            win.webContents.send('update-gif', newGif);
        }
    }
});

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});