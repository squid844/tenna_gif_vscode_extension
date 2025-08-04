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

}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});