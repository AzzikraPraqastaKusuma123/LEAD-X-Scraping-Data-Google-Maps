const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startScraping: (queries) => ipcRenderer.send('start-scraping', queries),
    stopScraping: () => ipcRenderer.send('stop-scraping'), // Channel baru untuk stop
    onScraperUpdate: (callback) => ipcRenderer.on('scraper-update', (_event, value) => callback(value)),
    exportToCSV: (leads) => ipcRenderer.send('export-csv', leads)
});