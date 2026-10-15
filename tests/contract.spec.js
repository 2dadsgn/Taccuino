const fs = require('fs');
const path = require('path');
const { TaccuinoStore } = require('../electron/store');

function runContractTests() {
  const results = [];

  function assert(testName, condition, detail = '') {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: detail });
    }
  }

  // 1. Contract JSON Schema Validation
  const contractPath = path.join(__dirname, '..', 'contracts', 'ipc.contract.json');
  assert('Contract File Exists', fs.existsSync(contractPath), `File not found: ${contractPath}`);

  if (fs.existsSync(contractPath)) {
    const raw = fs.readFileSync(contractPath, 'utf8');
    let contract = null;
    try {
      contract = JSON.parse(raw);
      assert('Contract is Valid JSON', true);
    } catch (e) {
      assert('Contract is Valid JSON', false, e.message);
    }

    if (contract && contract.endpoints) {
      const endpoints = contract.endpoints;
      assert('Contains IPC: get-entries endpoint', !!endpoints['IPC: get-entries']);
      assert('Contains IPC: add-entry endpoint', !!endpoints['IPC: add-entry']);
      assert('Contains IPC: get-balances endpoint', !!endpoints['IPC: get-balances']);
      assert('IPC contract defines category enum with only fisco and ectoplasma', !raw.includes('"entrambi"'));

      // Validate get-entries schema
      const getEntries = endpoints['IPC: get-entries'];
      assert('get-entries requires month and year', 
        getEntries.request && getEntries.request.required && 
        getEntries.request.required.includes('month') && getEntries.request.required.includes('year')
      );

      // Validate add-entry schema
      const addEntry = endpoints['IPC: add-entry'];
      assert('add-entry requires date, notes, amount, type',
        addEntry.request && addEntry.request.required &&
        ['date', 'notes', 'amount', 'type'].every(f => addEntry.request.required.includes(f))
      );

      // Validate get-balances schema
      const getBalances = endpoints['IPC: get-balances'];
      assert('get-balances response requires all 5 balance metrics',
        getBalances.response && getBalances.response.required &&
        ['bilancio_totale', 'bilancio_mensile', 'bilancio_annuale', 'uscite_mensili', 'entrate_mensili'].every(
          f => getBalances.response.required.includes(f)
        )
      );
      assert('get-balances response defines ectoplasma balance fields',
        getBalances.response && getBalances.response.properties &&
        !!getBalances.response.properties.bilancio_totale_con_ectoplasma &&
        !!getBalances.response.properties.bilancio_mensile_con_ectoplasma &&
        !!getBalances.response.properties.bilancio_annuale_con_ectoplasma
      );

      // Validate export and import endpoints
      assert('Contains IPC: export-csv endpoint', !!endpoints['IPC: export-csv']);
      assert('Contains IPC: get-all-entries endpoint', !!endpoints['IPC: get-all-entries']);
      assert('Contains IPC: import-csv endpoint', !!endpoints['IPC: import-csv']);
      const importCsvEp = endpoints['IPC: import-csv'];
      assert('import-csv response requires success and importedCount',
        importCsvEp.response && importCsvEp.response.required &&
        ['success', 'importedCount'].every(f => importCsvEp.response.required.includes(f))
      );

      // Validate delete, reset, and 2FA endpoints
      assert('Contains IPC: delete-entry endpoint', !!endpoints['IPC: delete-entry']);
      assert('Contains IPC: reset-database endpoint', !!endpoints['IPC: reset-database']);
      assert('Contains IPC: get-auth-status endpoint', !!endpoints['IPC: get-auth-status']);
      assert('Contains IPC: setup-auth endpoint', !!endpoints['IPC: setup-auth']);
      assert('Contains IPC: verify-auth-code endpoint', !!endpoints['IPC: verify-auth-code']);
    }
  }

  // 2. TypeScript Contract Model Verification
  const modelsPath = path.join(__dirname, '..', 'contracts', 'models.ts');
  assert('TypeScript Models File Exists', fs.existsSync(modelsPath), `File not found: ${modelsPath}`);
  if (fs.existsSync(modelsPath)) {
    const content = fs.readFileSync(modelsPath, 'utf8');
    assert('Models define Entry interface', content.includes('interface Entry'));
    assert('Models define IncomeCategory type', content.includes('IncomeCategory'));
    assert('IncomeCategory strictly equals fisco or ectoplasma', content.includes("export type IncomeCategory = 'fisco' | 'ectoplasma';"));
    assert('Models define GetEntriesRequest', content.includes('interface GetEntriesRequest'));
    assert('Models define AddEntryRequest', content.includes('interface AddEntryRequest'));
    assert('Models define ExportCsvRequest', content.includes('interface ExportCsvRequest'));
    assert('Models define GetAllEntriesResponse', content.includes('interface GetAllEntriesResponse'));
    assert('Models define ImportCsvRequest', content.includes('interface ImportCsvRequest'));
    assert('Models define ImportCsvResponse', content.includes('interface ImportCsvResponse'));
    assert('Models define DeleteEntryRequest', content.includes('interface DeleteEntryRequest'));
    assert('Models define ResetDatabaseResponse', content.includes('interface ResetDatabaseResponse'));
    assert('Models define GetAuthStatusResponse', content.includes('interface GetAuthStatusResponse'));
    assert('Models define SetupAuthRequest', content.includes('interface SetupAuthRequest'));
    assert('Models define VerifyAuthCodeRequest', content.includes('interface VerifyAuthCodeRequest'));
    assert('Models define importCsv in ElectronIpcBridge', content.includes('importCsv?'));
    assert('Models define deleteEntry in ElectronIpcBridge', content.includes('deleteEntry?'));
    assert('Models define resetDatabase in ElectronIpcBridge', content.includes('resetDatabase?'));
    assert('Models define getAuthStatus in ElectronIpcBridge', content.includes('getAuthStatus?'));
    assert('Models define GetBalancesResponse with ectoplasma fields', 
      content.includes('bilancio_totale_con_ectoplasma') &&
      content.includes('bilancio_mensile_con_ectoplasma') &&
      content.includes('bilancio_annuale_con_ectoplasma')
    );
  }

  // 3. Electron Store Contract Conformance
  const tempDb = path.join(__dirname, 'temp_test_contract_store.json');
  try {
    const store = new TaccuinoStore(tempDb, { useSeed: true });

    // Test get-entries
    const entriesRes = store.getEntries(10, 2026);
    assert('Store getEntries returns array', Array.isArray(entriesRes));
    assert('Store seed entries contain required fields', 
      entriesRes.length > 0 && 
      entriesRes.every(e => e.id && e.date && e.notes && typeof e.amount === 'number' && ['entrata', 'uscita'].includes(e.type))
    );

    // Test getAllEntries
    const allEntries = store.getAllEntries();
    assert('Store getAllEntries returns all entries', Array.isArray(allEntries) && allEntries.length >= entriesRes.length);

    // Test get-balances
    const balancesRes = store.getBalances(10, 2026);
    assert('Store getBalances returns all 5 metrics',
      typeof balancesRes.bilancio_totale === 'number' &&
      typeof balancesRes.bilancio_mensile === 'number' &&
      typeof balancesRes.bilancio_annuale === 'number' &&
      typeof balancesRes.uscite_mensili === 'number' &&
      typeof balancesRes.entrate_mensili === 'number'
    );
    assert('Store getBalances returns ectoplasma metrics',
      typeof balancesRes.bilancio_totale_con_ectoplasma === 'number' &&
      typeof balancesRes.bilancio_mensile_con_ectoplasma === 'number' &&
      typeof balancesRes.bilancio_annuale_con_ectoplasma === 'number'
    );

    // Test add-entry
    const addRes = store.addEntry({
      date: '2026-10-22',
      notes: 'Test QA Entry',
      amount: 99.50,
      type: 'uscita'
    });
    assert('Store addEntry returns success and id', addRes && addRes.success === true && typeof addRes.id === 'string');

    // Test add-entry with ectoplasma
    const addEctoRes = store.addEntry({
      date: '2026-10-23',
      notes: 'Test Ectoplasma Entry',
      amount: 150.00,
      type: 'entrata',
      category: 'ectoplasma'
    });
    assert('Store addEntry handles ectoplasma entry', addEctoRes && addEctoRes.success === true);

    // Test delete-entry
    const delRes = store.deleteEntry(addRes.id);
    assert('Store deleteEntry returns success', delRes && delRes.success === true);
    assert('Store deleteEntry removed the entry', !store.entries.some(e => e.id === addRes.id));

    // Test store importCsv
    const csvContent = "Data,Descrizione,Importo,Tipo,Categoria\n2026-10-24,Imported Sample,55.00,uscita,\n2026-10-25,Bonus,250.00,entrata,fisco";
    const importRes = store.importCsv(csvContent);
    assert('Store importCsv returns success and importedCount', importRes && importRes.success === true && importRes.importedCount === 2);

    // Test reset-database
    const resetRes = store.resetDatabase();
    assert('Store resetDatabase returns success', resetRes && resetRes.success === true);
    assert('Store resetDatabase leaves 0 entries', store.entries.length === 0);

    // Test store encryption
    assert('Store isEncrypted reports true', store.isEncrypted() === true);
    assert('Store file on disk is encrypted with AES-256-GCM', store.isStoreFileEncrypted() === true);

  } finally {
    if (fs.existsSync(tempDb)) {
      fs.unlinkSync(tempDb);
    }
    const tempKey = path.join(__dirname, '.' + path.basename(tempDb) + '.key');
    if (fs.existsSync(tempKey)) {
      fs.unlinkSync(tempKey);
    }
  }

  // 4. Electron Main Process & Preload Bridge Conformance
  const mainPath = path.join(__dirname, '..', 'electron', 'main.js');
  if (fs.existsSync(mainPath)) {
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    assert('main.js handles get-entries', mainContent.includes("'get-entries'"));
    assert('main.js handles add-entry', mainContent.includes("'add-entry'"));
    assert('main.js handles get-balances', mainContent.includes("'get-balances'"));
    assert('main.js handles get-all-entries', mainContent.includes("'get-all-entries'"));
    assert('main.js handles export-csv', mainContent.includes("'export-csv'"));
    assert('main.js handles import-csv', mainContent.includes("'import-csv'"));
    assert('main.js handles delete-entry', mainContent.includes("'delete-entry'"));
    assert('main.js handles reset-database', mainContent.includes("'reset-database'"));
    assert('main.js handles get-auth-status', mainContent.includes("'get-auth-status'"));
    assert('main.js handles setup-auth', mainContent.includes("'setup-auth'"));
    assert('main.js handles verify-auth-code', mainContent.includes("'verify-auth-code'"));
  }

  const preloadPath = path.join(__dirname, '..', 'electron', 'preload.js');
  if (fs.existsSync(preloadPath)) {
    const preloadContent = fs.readFileSync(preloadPath, 'utf8');
    assert('preload.js exposes getEntries', preloadContent.includes('getEntries:'));
    assert('preload.js exposes addEntry', preloadContent.includes('addEntry:'));
    assert('preload.js exposes getBalances', preloadContent.includes('getBalances:'));
    assert('preload.js exposes getAllEntries', preloadContent.includes('getAllEntries:'));
    assert('preload.js exposes exportCsv', preloadContent.includes('exportCsv:'));
    assert('preload.js exposes importCsv', preloadContent.includes('importCsv:'));
    assert('preload.js exposes deleteEntry', preloadContent.includes('deleteEntry:'));
    assert('preload.js exposes resetDatabase', preloadContent.includes('resetDatabase:'));
    assert('preload.js exposes getAuthStatus', preloadContent.includes('getAuthStatus:'));
    assert('preload.js exposes setupAuth', preloadContent.includes('setupAuth:'));
    assert('preload.js exposes verifyAuthCode', preloadContent.includes('verifyAuthCode:'));
  }

  return results;
}

module.exports = { runContractTests };
