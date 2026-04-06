const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const xlsx = require('xlsx');

let mainWindow;
let pythonProcess = null; // Variabel baru untuk menyimpan proses Python

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, 'src', 'assets', 'leadx.ico'),
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

    // Logika buka WA spesifik di Firefox
    ipcMain.on('open-wa-firefox', (event, url) => {
        const { exec } = require('child_process');
        // Command "start firefox" akan memaksa OS (Windows) untuk membuka URL ini khusus melalui Firefox
        exec(`start firefox "${url}"`, (error) => {
            if (error) {
                console.error('Gagal membuka Firefox, fallback ke default browser:', error);
                require('electron').shell.openExternal(url);
            }
        });
    });

    // Logika untuk ekspor Excel (versi lengkap dengan format rapi)
    ipcMain.on('export-excel', (event, leads) => {
        dialog.showSaveDialog(mainWindow, {
            title: 'Simpan Data Prospek - LEAD-X',
            defaultPath: `LEADX-Prospek-${new Date().toISOString().slice(0,10)}.xlsx`,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        }).then(result => {
            if (!result.canceled && result.filePath) {
                try {
                    // Mapping kolom: key data -> header bahasa Indonesia
                    const columnMap = [
                        { key: 'nama',             header: 'Nama Bisnis' },
                        { key: 'alamat',           header: 'Alamat' },
                        { key: 'telepon',          header: 'Telepon' },
                        { key: 'website',          header: 'Website' },
                        { key: 'email',            header: 'Email' },
                        { key: 'jumlah_ulasan',    header: 'Jumlah Ulasan' },
                        { key: 'sumber_pencarian', header: 'Sumber Pencarian' },
                        { key: 'tech_stack',       header: 'Tech Stack' },
                    ];

                    // Buat baris data dengan urutan kolom yang benar
                    const rows = leads.map(lead => {
                        const row = {};
                        columnMap.forEach(col => {
                            let val = lead[col.key];
                            // Social media: ubah object jadi string
                            if (col.key === 'social_media' && typeof val === 'object' && val !== null) {
                                val = Object.entries(val).map(([k,v]) => `${k}: ${v}`).join(' | ');
                            }
                            row[col.header] = val !== undefined && val !== null ? val : 'N/A';
                        });
                        return row;
                    });

                    const worksheet = xlsx.utils.json_to_sheet(rows, {
                        header: columnMap.map(c => c.header)
                    });

                    // Set lebar kolom otomatis berdasarkan konten terpanjang
                    const colWidths = columnMap.map(col => {
                        const maxLen = Math.max(
                            col.header.length,
                            ...leads.map(lead => {
                                const v = lead[col.key];
                                return v ? String(v).length : 3;
                            })
                        );
                        return { wch: Math.min(maxLen + 4, 60) }; // max 60 char
                    });
                    worksheet['!cols'] = colWidths;

                    // Freeze baris pertama (header)
                    worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

                    const workbook = xlsx.utils.book_new();
                    xlsx.utils.book_append_sheet(workbook, worksheet, 'Prospek LEAD-X');
                    xlsx.writeFile(workbook, result.filePath);

                    console.log('File Excel berhasil disimpan!');
                    mainWindow.webContents.send('scraper-update', { type: 'status', payload: `✅ Ekspor ${leads.length} prospek ke Excel berhasil!` });
                } catch (err) {
                    console.error('Gagal menyimpan file Excel:', err);
                    mainWindow.webContents.send('scraper-update', { type: 'error', payload: 'Gagal mengekspor Excel: ' + err.message });
                }
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