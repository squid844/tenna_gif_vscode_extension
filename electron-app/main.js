process.removeAllListeners('warning');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;
let currentGif = 'tenna_1.gif';

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

    win.show();
    win.focus();
    ipcMain.on('change-gif', (event, name) => {
        currentGif = name;
        win.webContents.send('update-gif', currentGif);
    });
}

app.whenReady().then(() => {
    createWindow();
});