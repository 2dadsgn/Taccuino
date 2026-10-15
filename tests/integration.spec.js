const fs = require('fs');
const path = require('path');
const { TaccuinoStore, generateTotp } = require('../electron/store');

async function runIntegrationTests() {
  const results = [];

  function assert(testName, condition, detail = '') {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: detail });
    }
  }

  const tempDb = path.join(__dirname, 'temp_integration_store.json');
  try {
    const store = new TaccuinoStore(tempDb, { useSeed: true });

    // Scenario 1: Initial wireframe October 2026 data verification
    const initialEntries = store.getEntries(10, 2026);
    assert('October 2026 contains exactly 4 entries initially', initialEntries.length === 4);

    const stipendio = initialEntries.find(e => e.notes === 'Stipendio');
    assert('Contains Stipendio entry with 2100 ENTRATA', stipendio && stipendio.amount === 2100 && stipendio.type === 'entrata');

    const spesa = initialEntries.find(e => e.notes === 'Spesa Coop');
    assert('Contains Spesa Coop entry with 120 USCITA', spesa && spesa.amount === 120 && spesa.type === 'uscita');

    const luce = initialEntries.find(e => e.notes === 'Bolletta Luce');
    assert('Contains Bolletta Luce entry with 85 USCITA', luce && luce.amount === 85 && luce.type === 'uscita');

    const cena = initialEntries.find(e => e.notes === 'Cena fuori');
    assert('Contains Cena fuori entry with 60 USCITA', cena && cena.amount === 60 && cena.type === 'uscita');

    const initialBalances = store.getBalances(10, 2026);
    assert('Initial Bilancio Totale equals € 14,500.00', initialBalances.bilancio_totale === 14500, `Got: ${initialBalances.bilancio_totale}`);
    assert('Initial Bilancio Annuale equals € 8,200.00', initialBalances.bilancio_annuale === 8200, `Got: ${initialBalances.bilancio_annuale}`);
    assert('Initial Bilancio Mensile equals € +1,835.00', initialBalances.bilancio_mensile === 1835, `Got: ${initialBalances.bilancio_mensile}`);
    assert('Initial Entrate Mensili equals € 2,100.00', initialBalances.entrate_mensili === 2100, `Got: ${initialBalances.entrate_mensili}`);
    assert('Initial Uscite Mensili equals € 265.00', initialBalances.uscite_mensili === 265, `Got: ${initialBalances.uscite_mensili}`);
    assert('Initial Bilancio Totale con Ectoplasma equals € 14,500.00', initialBalances.bilancio_totale_con_ectoplasma === 14500);
    assert('Initial Bilancio Mensile con Ectoplasma equals € 1,835.00', initialBalances.bilancio_mensile_con_ectoplasma === 1835);

    // Scenario 2: User adds a Fisco income entry via [+] modal
    const addIncome = store.addEntry({
      date: '2026-10-25',
      notes: 'Consulenza Freelance',
      amount: 800,
      type: 'entrata',
      category: 'fisco'
    });
    assert('Add income returns success with generated ID', addIncome.success === true && !!addIncome.id);

    const afterIncomeBalances = store.getBalances(10, 2026);
    assert('After Income: Entrate Mensili updated to 2900', afterIncomeBalances.entrate_mensili === 2900);
    assert('After Income: Bilancio Mensile updated to 2635', afterIncomeBalances.bilancio_mensile === 2635);
    assert('After Income: Bilancio Annuale updated to 9000', afterIncomeBalances.bilancio_annuale === 9000);
    assert('After Income: Bilancio Totale updated to 15300', afterIncomeBalances.bilancio_totale === 15300);
    assert('After Income: Bilancio Mensile con Ectoplasma updated to 2635', afterIncomeBalances.bilancio_mensile_con_ectoplasma === 2635);

    // Scenario 3: User adds an Ectoplasma income entry via [+] modal
    const addEcto = store.addEntry({
      date: '2026-10-26',
      notes: 'Incasso Ectoplasma Speciale',
      amount: 500,
      type: 'entrata',
      category: 'ectoplasma'
    });
    assert('Add ectoplasma entry returns success with generated ID', addEcto.success === true && !!addEcto.id);

    const ectoEntry = store.entries.find(e => e.id === addEcto.id);
    assert('Mutual Exclusivity: Entry has strictly category ectoplasma', ectoEntry && ectoEntry.category === 'ectoplasma' && ectoEntry.subType === 'ectoplasma');
    const fiscoEntry = store.entries.find(e => e.id === addIncome.id);
    assert('Mutual Exclusivity: Entry has strictly category fisco', fiscoEntry && fiscoEntry.category === 'fisco' && fiscoEntry.subType === 'fisco');

    const afterEctoBalances = store.getBalances(10, 2026);
    // Strict isolation: Fisco-only balances MUST remain untouched
    assert('Fisco Isolation: Entrate Mensili remains 2900 (Fisco exclusively)', afterEctoBalances.entrate_mensili === 2900);
    assert('Fisco Isolation: Bilancio Mensile remains 2635 (Fisco exclusively)', afterEctoBalances.bilancio_mensile === 2635);
    assert('Fisco Isolation: Bilancio Annuale remains 9000 (Fisco exclusively)', afterEctoBalances.bilancio_annuale === 9000);
    assert('Fisco Isolation: Bilancio Totale remains 15300 (Fisco exclusively)', afterEctoBalances.bilancio_totale === 15300);

    // Ectoplasma sub-fields MUST include the ectoplasma income
    assert('Sub-field: Bilancio Mensile con Ectoplasma updated to 3135', afterEctoBalances.bilancio_mensile_con_ectoplasma === 3135);
    assert('Sub-field: Bilancio Annuale con Ectoplasma updated to 9500', afterEctoBalances.bilancio_annuale_con_ectoplasma === 9500);
    assert('Sub-field: Bilancio Totale con Ectoplasma updated to 15800', afterEctoBalances.bilancio_totale_con_ectoplasma === 15800);
    assert('Sub-field: Entrate Mensili Ectoplasma equals 500', afterEctoBalances.entrate_mensili_ectoplasma === 500);

    // Scenario 4: User adds an expense entry via [+] modal
    const addExpense = store.addEntry({
      date: '2026-10-27',
      notes: 'Assicurazione Auto',
      amount: 350,
      type: 'uscita'
    });
    assert('Add expense returns success with generated ID', addExpense.success === true && !!addExpense.id);

    const afterExpenseBalances = store.getBalances(10, 2026);
    assert('After Expense: Uscite Mensili updated to 615', afterExpenseBalances.uscite_mensili === 615);
    assert('After Expense: Bilancio Mensile updated to 2285', afterExpenseBalances.bilancio_mensile === 2285);
    assert('After Expense: Bilancio Annuale updated to 8650', afterExpenseBalances.bilancio_annuale === 8650);
    assert('After Expense: Bilancio Totale updated to 14950', afterExpenseBalances.bilancio_totale === 14950);
    assert('After Expense: Bilancio Mensile con Ectoplasma updated to 2785', afterExpenseBalances.bilancio_mensile_con_ectoplasma === 2785);
    assert('After Expense: Bilancio Totale con Ectoplasma updated to 15450', afterExpenseBalances.bilancio_totale_con_ectoplasma === 15450);

    // Scenario 5: User navigates month arrows to November 2026
    const novEntries = store.getEntries(11, 2026);
    assert('November 2026 has 0 entries', novEntries.length === 0);
    const novBalances = store.getBalances(11, 2026);
    assert('November 2026 Entrate is 0', novBalances.entrate_mensili === 0);
    assert('November 2026 Uscite is 0', novBalances.uscite_mensili === 0);
    assert('November 2026 Bilancio Mensile is 0', novBalances.bilancio_mensile === 0);
    assert('November 2026 Bilancio Mensile con Ectoplasma is 0', novBalances.bilancio_mensile_con_ectoplasma === 0);
    assert('Annual and Total balances persist across month navigation', novBalances.bilancio_annuale === 8650 && novBalances.bilancio_totale === 14950);
    assert('Annual and Total con Ectoplasma balances persist across month navigation', novBalances.bilancio_annuale_con_ectoplasma === 9150 && novBalances.bilancio_totale_con_ectoplasma === 15450);

    // Scenario 6: User navigates backwards to September 2026
    const sepEntries = store.getEntries(9, 2026);
    assert('September 2026 has historical Stipendio Settembre entry', sepEntries.length === 1 && sepEntries[0].notes === 'Stipendio Settembre');
    const sepBalances = store.getBalances(9, 2026);
    assert('September 2026 Bilancio Mensile is 2100', sepBalances.bilancio_mensile === 2100);
    assert('September 2026 Bilancio Mensile con Ectoplasma is 2100', sepBalances.bilancio_mensile_con_ectoplasma === 2100);

    // Scenario 7: Production clean initialization (Zero mock data packaged)
    const tempDbClean = path.join(__dirname, 'temp_clean_prod_store.json');
    try {
      const cleanStore = new TaccuinoStore(tempDbClean, { useSeed: false });
      assert('Production store initializes with 0 entries (no mock data)', cleanStore.entries.length === 0);
      const cleanBalances = cleanStore.getBalances(10, 2026);
      assert('Production store total balance is 0 initially', cleanBalances.bilancio_totale === 0);
      assert('Production store monthly balance is 0 initially', cleanBalances.bilancio_mensile === 0);

      // Verify clean store can export empty or populated data
      const cleanAll = cleanStore.getAllEntries();
      assert('Clean store getAllEntries returns empty array', Array.isArray(cleanAll) && cleanAll.length === 0);

      // Scenario 8: Import from CSV with Italian DD/MM/YYYY dates and Fisco/Ectoplasma
      const csvData = [
        'Data,Descrizione,Importo (€),Tipo Movimento,Categoria',
        '10/10/2026,Stipendio Principale,2500.00,ENTRATA,fisco',
        '12/10/2026,Spesa Alimentari,150.00,USCITA,',
        '15/10/2026,Guadagno Ectoplasma,400.00,ENTRATA,ectoplasma'
      ].join('\r\n');

      const importResult = cleanStore.importCsv(csvData);
      assert('Import CSV into clean store returns success with count 3', importResult.success === true && importResult.importedCount === 3);

      const importedEntries = cleanStore.getEntries(10, 2026);
      assert('Imported entries count for Oct 2026 is 3', importedEntries.length === 3);

      const importedBalances = cleanStore.getBalances(10, 2026);
      assert('Imported CSV balances: Entrate Mensili equals 2500 (Fisco only)', importedBalances.entrate_mensili === 2500);
      assert('Imported CSV balances: Uscite Mensili equals 150', importedBalances.uscite_mensili === 150);
      assert('Imported CSV balances: Bilancio Mensile equals 2350', importedBalances.bilancio_mensile === 2350);
      assert('Imported CSV balances: Bilancio Mensile con Ectoplasma equals 2750', importedBalances.bilancio_mensile_con_ectoplasma === 2750);
      assert('Imported CSV balances: Entrate Mensili Ectoplasma equals 400', importedBalances.entrate_mensili_ectoplasma === 400);

      // Scenario 9: Semicolon delimited CSV with European comma decimals
      const semiCsv = [
        'Data;Descrizione / Note;Importo (€);Tipo Movimento;Categoria Entrata',
        '20/10/2026;Rifornimento Carburante;85,50;USCITA;-'
      ].join('\r\n');

      const semiImport = cleanStore.importCsv(semiCsv);
      assert('Import semicolon CSV returns success with count 1', semiImport.success === true && semiImport.importedCount === 1);
      const fuelEntry = cleanStore.getEntries(10, 2026).find(e => e.notes === 'Rifornimento Carburante');
      assert('Semicolon parsed entry has correct amount 85.50', fuelEntry && fuelEntry.amount === 85.5);

      // Scenario 10: Delete entry by ID and verify balance adjustment
      const delRes = cleanStore.deleteEntry(fuelEntry.id);
      assert('Delete fuel entry returns success', delRes && delRes.success === true);
      const afterDelBalances = cleanStore.getBalances(10, 2026);
      assert('After deleting expense: Uscite Mensili returns to 150', afterDelBalances.uscite_mensili === 150);

      // Scenario 11: Reset entire database and verify clean state
      const resetRes = cleanStore.resetDatabase();
      assert('Reset database returns success', resetRes && resetRes.success === true);
      assert('After database reset: entries length is 0', cleanStore.entries.length === 0);
      const resetBalances = cleanStore.getBalances(10, 2026);
      assert('After database reset: Bilancio Totale equals 0', resetBalances.bilancio_totale === 0);
      assert('After database reset: Bilancio Mensile equals 0', resetBalances.bilancio_mensile === 0);

      // Scenario 12: 2FA Google Authenticator flow
      const tempAuth = path.join(__dirname, 'temp_test_auth.json');
      try {
        cleanStore.authPath = tempAuth;
        cleanStore.resetAuth();
        const initialAuth = await cleanStore.getAuthStatus();
        assert('Initial auth status is not configured', initialAuth.isConfigured === false && initialAuth.isAuthenticated === false);
        assert('Initial auth provides 16-char base32 secret', !!initialAuth.secret && initialAuth.secret.length === 16);
        assert('Initial auth provides otpauth URL with issuer Taccuino', initialAuth.otpauthUrl && initialAuth.otpauthUrl.includes('issuer=Taccuino'));

        const validCode = generateTotp(initialAuth.secret);
        const badSetup = cleanStore.setupAuth(initialAuth.secret, '000000');
        assert('Setup auth with bad code fails', badSetup && badSetup.success === false);

        const goodSetup = cleanStore.setupAuth(initialAuth.secret, validCode);
        assert('Setup auth with valid code succeeds', goodSetup && goodSetup.success === true);
        assert('After setup: cleanStore is authenticated', cleanStore.isAuthenticated === true);

        cleanStore.isAuthenticated = false;
        const badLogin = cleanStore.verifyAuthCode('123456');
        assert('Login with invalid code fails', badLogin && badLogin.success === false);

        const goodLogin = cleanStore.verifyAuthCode(validCode);
        assert('Login with valid Google Authenticator code succeeds', goodLogin && goodLogin.success === true);
        assert('After login: cleanStore is authenticated', cleanStore.isAuthenticated === true);
      } finally {
        if (fs.existsSync(tempAuth)) {
          fs.unlinkSync(tempAuth);
        }
      }

      // Scenario 13: AES-256-GCM file encryption at rest, decryption, non-leakage, and tamper detection
      const tempEncDb = path.join(__dirname, 'temp_enc_test_store.json');
      try {
        const encStore = new TaccuinoStore(tempEncDb, { useSeed: false });
        encStore.addEntry({
          date: '2026-10-28',
          notes: 'Top Secret Transaction Notes',
          amount: 5500.75,
          type: 'entrata',
          category: 'fisco'
        });

        // 1. Raw file verification: verify plaintext is absent and ciphertext structure is present
        const rawContent = fs.readFileSync(tempEncDb, 'utf8');
        assert('Encrypted store file on disk is valid JSON', typeof rawContent === 'string' && rawContent.startsWith('{'));
        assert('Raw store file does not leak sensitive description string', !rawContent.includes('Top Secret Transaction Notes'));
        assert('Raw store file does not leak plain numeric amount string', !rawContent.includes('5500.75'));

        const parsedEnvelope = JSON.parse(rawContent);
        assert('Payload marked as encrypted: true', parsedEnvelope.encrypted === true);
        assert('Payload specifies algorithm: aes-256-gcm', parsedEnvelope.algorithm === 'aes-256-gcm');
        assert('Payload includes 24-char hex IV (96-bit)', typeof parsedEnvelope.iv === 'string' && parsedEnvelope.iv.length === 24);
        assert('Payload includes 32-char hex authentication tag (128-bit)', typeof parsedEnvelope.tag === 'string' && parsedEnvelope.tag.length === 32);
        assert('Payload includes non-empty ciphertext data', typeof parsedEnvelope.data === 'string' && parsedEnvelope.data.length > 0);

        // 2. Decrypt & reload verification: verify new instance reads data perfectly
        const reloadedStore = new TaccuinoStore(tempEncDb, { useSeed: false, keyPath: encStore.keyPath });
        assert('Reloaded store decrypts and recovers 1 entry', reloadedStore.entries.length === 1);
        assert('Recovered entry contains original notes and amount', reloadedStore.entries[0].notes === 'Top Secret Transaction Notes' && reloadedStore.entries[0].amount === 5500.75);

        // 3. Tamper detection: verify altering ciphertext causes GCM authentication tag mismatch
        parsedEnvelope.data = 'ff' + parsedEnvelope.data.slice(2);
        let tamperFailed = false;
        try {
          encStore.decrypt(parsedEnvelope);
        } catch (e) {
          tamperFailed = true;
        }
        assert('AES-256-GCM detects ciphertext tampering and fails authentication', tamperFailed);

        // 4. Legacy migration: unencrypted legacy JSON array is automatically migrated to encrypted format
        const legacyPlain = JSON.stringify([{ id: 'leg-1', date: '2026-10-29', notes: 'Legacy Note', amount: 300, type: 'uscita' }]);
        fs.writeFileSync(tempEncDb, legacyPlain, 'utf8');
        const legacyStore = new TaccuinoStore(tempEncDb, { useSeed: false, keyPath: encStore.keyPath });
        assert('Legacy store recovers entries seamlessly', legacyStore.entries.length === 1 && legacyStore.entries[0].notes === 'Legacy Note');
        const reEncryptedContent = fs.readFileSync(tempEncDb, 'utf8');
        assert('Legacy store automatically re-saved as encrypted AES-256-GCM', reEncryptedContent.includes('"encrypted": true') && !reEncryptedContent.includes('Legacy Note'));

      } finally {
        if (fs.existsSync(tempEncDb)) fs.unlinkSync(tempEncDb);
        const encKey = path.join(path.dirname(tempEncDb), '.' + path.basename(tempEncDb) + '.key');
        if (fs.existsSync(encKey)) fs.unlinkSync(encKey);
      }

    } finally {
      if (fs.existsSync(tempDbClean)) {
        fs.unlinkSync(tempDbClean);
      }
      const cleanKey = path.join(path.dirname(tempDbClean), '.' + path.basename(tempDbClean) + '.key');
      if (fs.existsSync(cleanKey)) fs.unlinkSync(cleanKey);
    }

  } finally {
    if (fs.existsSync(tempDb)) {
      fs.unlinkSync(tempDb);
    }
    const tempKey = path.join(path.dirname(tempDb), '.' + path.basename(tempDb) + '.key');
    if (fs.existsSync(tempKey)) fs.unlinkSync(tempKey);
  }

  return results;
}

module.exports = { runIntegrationTests };
