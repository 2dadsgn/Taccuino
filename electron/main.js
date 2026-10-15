const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { TaccuinoStore } = require('./store');

let mainWindow = null;
let store = null;

function createWindow() {
  const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
  store = new TaccuinoStore(dataPath);

  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    title: 'Taccuino - Gestione Finanze Personali',
    backgroundColor: '#090e17',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const localDist = path.join(__dirname, 'dist', 'index.html');
  const parentDist = path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'index.html');

  if (fs.existsSync(localDist)) {
    mainWindow.loadFile(localDist);
  } else if (fs.existsSync(parentDist)) {
    mainWindow.loadFile(parentDist);
  } else {
    mainWindow.loadURL('http://localhost:4200');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers matching shared_contract
function registerIpcHandlers() {
  ipcMain.handle('get-entries', async (event, request) => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    const month = request && request.month ? Number(request.month) : 10;
    const year = request && request.year ? Number(request.year) : 2026;
    const entries = store.getEntries(month, year);
    return { entries };
  });

  ipcMain.handle('add-entry', async (event, request) => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    const res = store.addEntry(request);
    return res;
  });

  ipcMain.handle('get-balances', async (event, request) => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    const month = request && request.month ? Number(request.month) : 10;
    const year = request && request.year ? Number(request.year) : 2026;
    const balances = store.getBalances(month, year);
    return balances;
  });

  ipcMain.handle('get-all-entries', async () => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    const entries = store.getAllEntries ? store.getAllEntries() : store.entries;
    return { entries };
  });

  ipcMain.handle('export-csv', async (event, request) => {
    const defaultFilename = (request && request.defaultFilename) || `taccuino_export_${new Date().toISOString().slice(0, 10)}.csv`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Esporta Dati in CSV',
      defaultPath: defaultFilename,
      filters: [
        { name: 'File CSV (*.csv)', extensions: ['csv'] },
        { name: 'Tutti i file (*.*)', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    try {
      fs.writeFileSync(filePath, request.csv, 'utf8');
      return { success: true, filePath, canceled: false };
    } catch (err) {
      console.error('Failed to export CSV:', err);
      return { success: false, error: err.message, canceled: false };
    }
  });

  ipcMain.handle('import-csv', async (event, request) => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }

    try {
      let csvContent = request && request.csvContent;
      let targetFilePath = undefined;

      if (!csvContent) {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Importa Dati da CSV',
          filters: [
            { name: 'File CSV (*.csv; *.txt)', extensions: ['csv', 'txt'] },
            { name: 'Tutti i file (*.*)', extensions: ['*'] }
          ],
          properties: ['openFile']
        });

        if (canceled || !filePaths || filePaths.length === 0) {
          return { success: false, importedCount: 0, canceled: true };
        }

        targetFilePath = filePaths[0];
        csvContent = fs.readFileSync(targetFilePath, 'utf8');
      }

      if (!csvContent || !csvContent.trim()) {
        return { success: false, importedCount: 0, error: 'File CSV vuoto.', canceled: false };
      }

      const res = store.importCsv(csvContent);
      return {
        success: res.success,
        importedCount: res.importedCount || 0,
        filePath: targetFilePath,
        canceled: false,
        error: res.error
      };
    } catch (err) {
      console.error('Failed to import CSV:', err);
      return { success: false, importedCount: 0, error: err.message, canceled: false };
    }
  });

  ipcMain.handle('delete-entry', async (event, request) => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    const res = store.deleteEntry(request && request.id);
    return res;
  });

  ipcMain.handle('reset-database', async () => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    const res = store.resetDatabase();
    return res;
  });

  ipcMain.handle('get-auth-status', async () => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    return await store.getAuthStatus();
  });

  ipcMain.handle('setup-auth', async (event, request) => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    return store.setupAuth(request && request.secret, request && request.code);
  });

  ipcMain.handle('verify-auth-code', async (event, request) => {
    if (!store) {
      const dataPath = path.join(app.getPath('userData'), 'taccuino_store.json');
      store = new TaccuinoStore(dataPath);
    }
    return store.verifyAuthCode(request && request.code);
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
