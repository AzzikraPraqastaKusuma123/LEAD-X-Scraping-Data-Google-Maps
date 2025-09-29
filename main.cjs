const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let pythonProcess = null; // Variabel baru untuk menyimpan proses Python

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

    // Menerima perintah "start-scraping"
    ipcMain.on('start-scraping', (event, queries) => {
        if (pythonProcess) {
            pythonProcess.kill();
        }
        
        pythonProcess = spawn('python', ['map_scraper.py', ...queries]);

        pythonProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim() !== '');
            lines.forEach(line => {
                try {
                    mainWindow.webContents.send('scraper-update', JSON.parse(line));
                } catch (e) {}
            });
        });
        pythonProcess.stderr.on('data', (data) => {
            mainWindow.webContents.send('scraper-update', { type: 'error', payload: data.toString() });
        });
        
        pythonProcess.on('close', () => {
             mainWindow.webContents.send('scraper-update', { type: 'status', payload: 'Proses dihentikan.' });
        });
    });

    // LOGIKA BARU: Menerima perintah untuk menghentikan scraping
    ipcMain.on('stop-scraping', () => {
        if (pythonProcess) {
            pythonProcess.kill();
            pythonProcess = null;
            console.log('Scraping dihentikan oleh pengguna.');
        }
    });

    // Logika untuk ekspor CSV
    ipcMain.on('export-csv', (event, leads) => {
        dialog.showSaveDialog(mainWindow, {
            title: 'Simpan Data Prospek', defaultPath: `leads-${Date.now()}.csv`,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        }).then(result => {
            if (!result.canceled && result.filePath) {
                const header = Object.keys(leads[0]).join(',');
                const rows = leads.map(lead => Object.values(lead).map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
                const csvContent = `${header}\n${rows.join('\n')}`;
                fs.writeFile(result.filePath, csvContent, (err) => {
                    if (err) console.error('Gagal menyimpan file CSV:', err);
                    else console.log('File CSV berhasil disimpan!');
                });
            }
        });
    });
}

app.whenReady().then(createWindow);

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
});