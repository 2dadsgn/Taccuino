const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

function parseEntryDate(dateStr) {
  if (!dateStr) return { year: 0, month: 0, day: 0 };
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/').map(Number);
    if (parts.length === 3) {
      if (parts[2] > 1000) {
        return { year: parts[2], month: parts[1], day: parts[0] };
      } else if (parts[0] > 1000) {
        return { year: parts[0], month: parts[1], day: parts[2] };
      }
    }
  }
  if (str.includes('-')) {
    const parts = str.split('-').map(Number);
    if (parts.length === 3) {
      if (parts[0] > 1000) {
        return { year: parts[0], month: parts[1], day: parts[2] };
      } else if (parts[2] > 1000) {
        return { year: parts[2], month: parts[1], day: parts[0] };
      }
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  return { year: 0, month: 0, day: 0 };
}

function stripQuotes(val) {
  if (!val) return '';
  let str = String(val).trim();
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    str = str.slice(1, -1).replace(/""/g, '"');
  }
  return str;
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(stripQuotes(cell));
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(stripQuotes(cell));
  return cells;
}

function parseCsvAmount(valStr) {
  if (valStr === undefined || valStr === null) return 0;
  let s = String(valStr).trim().replace(/[€$£\s]/g, '');
  const isNegative = s.startsWith('-') || s.startsWith('(');
  s = s.replace(/[-+()]/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : (isNegative ? -Math.abs(num) : Math.abs(num));
}

function detectColumnIndices(headers) {
  const mapping = {
    id: -1,
    date: -1,
    notes: -1,
    amount: -1,
    type: -1,
    category: -1
  };
  headers.forEach((h, idx) => {
    const clean = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean === 'id') {
      mapping.id = idx;
    } else if (clean.includes('data') || clean.includes('date')) {
      mapping.date = idx;
    } else if (clean.includes('desc') || clean.includes('note') || clean.includes('causale')) {
      mapping.notes = idx;
    } else if (clean.includes('import') || clean.includes('amount') || clean.includes('totale') || clean.includes('prezzo')) {
      mapping.amount = idx;
    } else if (clean.includes('tipo') || clean.includes('type') || clean.includes('moviment')) {
      mapping.type = idx;
    } else if (clean.includes('cat') || clean.includes('fisco') || clean.includes('sub') || clean.includes('ecto')) {
      mapping.category = idx;
    }
  });
  return mapping;
}

let QRCodeModule = null;
try {
  QRCodeModule = require('qrcode');
} catch (e) {
  // qrcode optional fallback
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(str).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0, bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateRandomBase32(length = 16) {
  const bytes = crypto.randomBytes(length);
  return base32Encode(bytes).substring(0, length);
}

function generateTotp(secret, offset = 0, timeStep = 30) {
  const key = typeof secret === 'string' ? base32Decode(secret) : secret;
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep) + offset;
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const o = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[o] & 0x7f) << 24 | (hmac[o + 1] & 0xff) << 16 | (hmac[o + 2] & 0xff) << 8 | (hmac[o + 3] & 0xff)) % 1000000;
  return String(code).padStart(6, '0');
}

function verifyTotp(secret, code, window = 1) {
  if (!secret || !code) return false;
  const cleanCode = String(code).trim();
  if (cleanCode.length !== 6) return false;
  for (let off = -window; off <= window; off++) {
    if (generateTotp(secret, off) === cleanCode) {
      return true;
    }
  }
  return false;
}

async function generateQrDataUrl(text) {
  if (QRCodeModule && QRCodeModule.toDataURL) {
    try {
      return await QRCodeModule.toDataURL(text, {
        margin: 2,
        width: 220,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.warn('QR code generation error:', err);
    }
  }
  return '';
}

class TaccuinoStore {
  constructor(customStoragePath, options = {}) {
    this.storagePath = customStoragePath || path.join(__dirname, 'taccuino_data.json');
    this.authPath = options.authPath || path.join(path.dirname(this.storagePath), 'taccuino_auth.json');
    this.customEncryptionKey = options.encryptionKey || null;
    if (options.keyPath) {
      this.keyPath = options.keyPath;
    } else {
      const baseName = path.basename(this.storagePath);
      this.keyPath = path.join(path.dirname(this.storagePath), '.' + baseName + '.key');
    }
    this.entries = [];
    this.authSecret = null;
    this.isAuthenticated = options.isAuthenticated !== undefined ? options.isAuthenticated : false;
    this.pendingSetupSecret = null;
    this.useSeed = options.useSeed !== undefined 
      ? options.useSeed 
      : (process.env.TACCUINO_USE_SEED === 'true' || process.env.NODE_ENV === 'test');
    this.load();
    this.loadAuth();
  }

  getEncryptionKey() {
    if (this.customEncryptionKey) {
      if (Buffer.isBuffer(this.customEncryptionKey) && this.customEncryptionKey.length === 32) {
        return this.customEncryptionKey;
      }
      return crypto.createHash('sha256').update(String(this.customEncryptionKey)).digest();
    }

    let rawKey = null;
    try {
      if (fs.existsSync(this.keyPath)) {
        const content = fs.readFileSync(this.keyPath, 'utf8').trim();
        if (content.length === 64) {
          rawKey = Buffer.from(content, 'hex');
        }
      }
    } catch (e) {
      console.warn('Could not read vault key:', e.message);
    }

    if (!rawKey) {
      rawKey = crypto.randomBytes(32);
      try {
        const dir = path.dirname(this.keyPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.keyPath, rawKey.toString('hex'), { encoding: 'utf8', mode: 0o600 });
      } catch (e) {
        console.warn('Could not persist vault key:', e.message);
      }
    }

    const userSalt = `${(os.userInfo && os.userInfo().username) || 'user'}_${process.env.COMPUTERNAME || 'pc'}_taccuino_vault`;
    return crypto.pbkdf2Sync(rawKey, userSalt, 10000, 32, 'sha256');
  }

  encrypt(plainText) {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(plainText, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
      encrypted: true,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
      data: ciphertext
    };
  }

  decrypt(payload) {
    if (!payload || !payload.data || !payload.iv || !payload.tag) {
      throw new Error('Formato crittografico non valido');
    }
    const key = this.getEncryptionKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.tag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  isEncrypted() {
    return true;
  }

  isStoreFileEncrypted() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const parsed = JSON.parse(raw);
        return !!(parsed && parsed.encrypted && parsed.algorithm === 'aes-256-gcm' && parsed.data && parsed.tag && parsed.iv);
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  getInitialSeed() {
    return [
      {
        id: 'seed-oct-1',
        date: '2026-10-12',
        notes: 'Stipendio',
        amount: 2100,
        type: 'entrata',
        category: 'fisco',
        subType: 'fisco'
      },
      {
        id: 'seed-oct-2',
        date: '2026-10-14',
        notes: 'Spesa Coop',
        amount: 120,
        type: 'uscita'
      },
      {
        id: 'seed-oct-3',
        date: '2026-10-15',
        notes: 'Bolletta Luce',
        amount: 85,
        type: 'uscita'
      },
      {
        id: 'seed-oct-4',
        date: '2026-10-20',
        notes: 'Cena fuori',
        amount: 60,
        type: 'uscita'
      },
      // Previous months in 2026 to reach Bilancio Annuale = € 8,200.00 (8200 - 1835 = 6365)
      {
        id: 'seed-sep-1',
        date: '2026-09-12',
        notes: 'Stipendio Settembre',
        amount: 2100,
        type: 'entrata',
        category: 'fisco',
        subType: 'fisco'
      },
      {
        id: 'seed-aug-1',
        date: '2026-08-12',
        notes: 'Stipendio Agosto',
        amount: 2100,
        type: 'entrata',
        category: 'fisco',
        subType: 'fisco'
      },
      {
        id: 'seed-jul-1',
        date: '2026-07-12',
        notes: 'Stipendio Luglio',
        amount: 2165,
        type: 'entrata',
        category: 'fisco',
        subType: 'fisco'
      },
      // 2025 Carry-over balance to reach Bilancio Totale = € 14,500.00 (14500 - 8200 = 6300)
      {
        id: 'seed-prev-year',
        date: '2025-12-31',
        notes: 'Giacenza iniziale 2025',
        amount: 6300,
        type: 'entrata',
        category: 'fisco',
        subType: 'fisco'
      }
    ];
  }

  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        let parsed = null;
        try {
          const jsonObj = JSON.parse(data);
          if (jsonObj && jsonObj.encrypted && jsonObj.data) {
            const decrypted = this.decrypt(jsonObj);
            parsed = JSON.parse(decrypted);
          } else if (Array.isArray(jsonObj)) {
            // Unencrypted legacy file: parse seamlessly
            parsed = jsonObj;
          }
        } catch (err) {
          console.warn('Could not parse or decrypt store file:', err.message);
        }

        if (Array.isArray(parsed)) {
          if (!this.useSeed) {
            // Strip any mock seed entries in production mode
            const realEntries = parsed.filter(e => !e.id || !String(e.id).startsWith('seed-'));
            this.entries = realEntries;
            this.save();
            return;
          }
          if (parsed.length > 0) {
            this.entries = parsed;
            this.save();
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Could not read store file:', err.message);
    }

    if (this.useSeed) {
      this.entries = this.getInitialSeed();
      this.save();
    } else {
      this.entries = [];
      this.save();
    }
  }

  save() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const jsonString = JSON.stringify(this.entries, null, 2);
      const encryptedPayload = this.encrypt(jsonString);
      fs.writeFileSync(this.storagePath, JSON.stringify(encryptedPayload, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write to store:', err);
    }
  }

  getAllEntries() {
    return [...this.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  getEntries(month, year) {
    if (!month && !year) {
      return [...this.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    const targetMonth = Number(month);
    const targetYear = Number(year);

    return this.entries.filter(entry => {
      const { year: y, month: m } = parseEntryDate(entry.date);
      return m === targetMonth && y === targetYear;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  addEntry(entryData) {
    const id = 'entry-' + (crypto.randomUUID ? crypto.randomUUID() : ('id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)));
    const isEntrata = entryData.type === 'entrata';
    const rawCat = isEntrata ? (entryData.category || entryData.subType || 'fisco') : undefined;
    const subType = isEntrata ? (rawCat === 'ectoplasma' ? 'ectoplasma' : 'fisco') : undefined;
    const newEntry = {
      id,
      date: String(entryData.date),
      notes: String(entryData.notes),
      amount: Number(entryData.amount),
      type: isEntrata ? 'entrata' : 'uscita'
    };
    if (isEntrata && subType) {
      newEntry.category = subType;
      newEntry.subType = subType;
    }

    this.entries.push(newEntry);
    this.save();
    return { success: true, id };
  }

  deleteEntry(id) {
    if (!id) return { success: false, error: 'ID mancante.' };
    const index = this.entries.findIndex(e => String(e.id) === String(id));
    if (index === -1) {
      return { success: false, error: 'Voce non trovata.' };
    }
    this.entries.splice(index, 1);
    this.save();
    return { success: true };
  }

  resetDatabase() {
    this.entries = [];
    this.save();
    return { success: true };
  }

  getBalances(month, year) {
    const targetMonth = Number(month);
    const targetYear = Number(year);

    let fiscoTotale = 0;
    let ectoTotale = 0;
    let usciteTotale = 0;

    let fiscoAnnuale = 0;
    let ectoAnnuale = 0;
    let usciteAnnuale = 0;

    let fiscoMensile = 0;
    let ectoMensile = 0;
    let usciteMensile = 0;

    for (const entry of this.entries) {
      const { year: y, month: m } = parseEntryDate(entry.date);
      const isEntrata = entry.type === 'entrata';
      const amount = Number(entry.amount);

      if (isEntrata) {
        const cat = entry.category || entry.subType || 'fisco';
        if (cat === 'ectoplasma') {
          ectoTotale += amount;
          if (y === targetYear) {
            ectoAnnuale += amount;
          }
          if (y === targetYear && m === targetMonth) {
            ectoMensile += amount;
          }
        } else {
          fiscoTotale += amount;
          if (y === targetYear) {
            fiscoAnnuale += amount;
          }
          if (y === targetYear && m === targetMonth) {
            fiscoMensile += amount;
          }
        }
      } else {
        usciteTotale += amount;
        if (y === targetYear) {
          usciteAnnuale += amount;
        }
        if (y === targetYear && m === targetMonth) {
          usciteMensile += amount;
        }
      }
    }

    const bilancioTotaleFisco = fiscoTotale - usciteTotale;
    const bilancioAnnualeFisco = fiscoAnnuale - usciteAnnuale;
    const bilancioMensileFisco = fiscoMensile - usciteMensile;

    const bilancioTotaleConEcto = (fiscoTotale + ectoTotale) - usciteTotale;
    const bilancioAnnualeConEcto = (fiscoAnnuale + ectoAnnuale) - usciteAnnuale;
    const bilancioMensileConEcto = (fiscoMensile + ectoMensile) - usciteMensile;

    return {
      bilancio_totale: Math.round(bilancioTotaleFisco * 100) / 100,
      bilancio_mensile: Math.round(bilancioMensileFisco * 100) / 100,
      bilancio_annuale: Math.round(bilancioAnnualeFisco * 100) / 100,
      uscite_mensili: Math.round(usciteMensile * 100) / 100,
      entrate_mensili: Math.round(fiscoMensile * 100) / 100,
      bilancio_totale_con_ectoplasma: Math.round(bilancioTotaleConEcto * 100) / 100,
      bilancio_mensile_con_ectoplasma: Math.round(bilancioMensileConEcto * 100) / 100,
      bilancio_annuale_con_ectoplasma: Math.round(bilancioAnnualeConEcto * 100) / 100,
      entrate_mensili_con_ectoplasma: Math.round((fiscoMensile + ectoMensile) * 100) / 100,
      entrate_mensili_ectoplasma: Math.round(ectoMensile * 100) / 100
    };
  }

  importEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return { success: true, importedCount: 0 };
    }

    let count = 0;
    for (const item of entries) {
      if (!item || !item.date || item.amount === undefined || isNaN(Number(item.amount))) {
        continue;
      }

      const { year, month, day } = parseEntryDate(item.date);
      let normalizedDate = String(item.date).trim();
      if (year > 1000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        normalizedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      const id = item.id || ('entry-' + (crypto.randomUUID ? crypto.randomUUID() : ('id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7))));
      const isEntrata = String(item.type).toLowerCase() === 'entrata';
      const rawCat = isEntrata ? (item.category || item.subType || 'fisco') : undefined;
      const cat = isEntrata ? (rawCat === 'ectoplasma' ? 'ectoplasma' : 'fisco') : undefined;

      const newEntry = {
        id,
        date: normalizedDate,
        notes: String(item.notes || '').trim(),
        amount: Math.abs(Number(item.amount)),
        type: isEntrata ? 'entrata' : 'uscita'
      };

      if (isEntrata && cat) {
        newEntry.category = cat;
        newEntry.subType = cat;
      }

      const existingIndex = this.entries.findIndex(e => e.id === id);
      if (existingIndex >= 0) {
        this.entries[existingIndex] = newEntry;
      } else {
        this.entries.push(newEntry);
      }
      count++;
    }

    if (count > 0) {
      this.save();
    }

    return { success: true, importedCount: count };
  }

  importCsv(csvContent) {
    if (!csvContent || !csvContent.trim()) {
      return { success: false, importedCount: 0, error: 'File CSV vuoto.' };
    }

    const raw = csvContent.replace(/^\uFEFF/, '').trim();
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      return { success: false, importedCount: 0, error: 'Nessuna riga valida trovata.' };
    }

    // Determine delimiter (count , vs ;)
    const firstLine = lines[0];
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const firstCells = parseCsvLine(firstLine, delimiter);
    const colMap = detectColumnIndices(firstCells);

    const hasHeader = colMap.date !== -1 || colMap.amount !== -1 || colMap.notes !== -1;
    const startIndex = hasHeader ? 1 : 0;

    const parsedEntries = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cells = parseCsvLine(line, delimiter);
      if (cells.length < 2) continue;

      let date = '';
      let notes = '';
      let amount = 0;
      let type = 'uscita';
      let category = undefined;
      let id = undefined;

      if (hasHeader) {
        if (colMap.id !== -1 && cells[colMap.id]) id = cells[colMap.id];
        if (colMap.date !== -1 && cells[colMap.date]) date = cells[colMap.date];
        if (colMap.notes !== -1 && cells[colMap.notes]) notes = cells[colMap.notes];
        if (colMap.amount !== -1 && cells[colMap.amount]) amount = parseCsvAmount(cells[colMap.amount]);
        if (colMap.type !== -1 && cells[colMap.type]) {
          const t = cells[colMap.type].toLowerCase();
          type = (t.includes('entrat') || t.includes('in') || t === '+') ? 'entrata' : 'uscita';
        }
        if (colMap.category !== -1 && cells[colMap.category]) {
          const c = cells[colMap.category].toLowerCase();
          if (c.includes('ecto')) category = 'ectoplasma';
          else if (c.includes('fisc')) category = 'fisco';
        }
      } else {
        date = cells[0];
        notes = cells[1] || '';
        amount = parseCsvAmount(cells[2] || 0);
        if (cells[3]) {
          const t = cells[3].toLowerCase();
          type = (t.includes('entrat') || t.includes('in') || t === '+') ? 'entrata' : 'uscita';
        }
        if (cells[4]) {
          const c = cells[4].toLowerCase();
          if (c.includes('ecto')) category = 'ectoplasma';
          else if (c.includes('fisc')) category = 'fisco';
        }
      }

      if (!date) continue;
      parsedEntries.push({ id, date, notes, amount, type, category });
    }

    return this.importEntries(parsedEntries);
  }

  loadAuth() {
    try {
      if (fs.existsSync(this.authPath)) {
        const raw = fs.readFileSync(this.authPath, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.secret) {
          this.authSecret = data.secret;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read auth file:', e.message);
    }
    this.authSecret = null;
  }

  saveAuth(secret) {
    try {
      const dir = path.dirname(this.authPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.authPath, JSON.stringify({ secret, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
      this.authSecret = secret;
    } catch (e) {
      console.error('Failed to save auth file:', e);
    }
  }

  resetAuth() {
    try {
      if (fs.existsSync(this.authPath)) {
        fs.unlinkSync(this.authPath);
      }
    } catch (e) {}
    this.authSecret = null;
    this.isAuthenticated = false;
    this.pendingSetupSecret = null;
    return { success: true };
  }

  async getAuthStatus() {
    if (this.authSecret) {
      return {
        isConfigured: true,
        isAuthenticated: this.isAuthenticated
      };
    }

    if (!this.pendingSetupSecret) {
      this.pendingSetupSecret = generateRandomBase32(16);
    }
    const secret = this.pendingSetupSecret;
    const otpauthUrl = `otpauth://totp/Taccuino:Utente?secret=${secret}&issuer=Taccuino`;
    const qrCodeDataUrl = await generateQrDataUrl(otpauthUrl);

    return {
      isConfigured: false,
      isAuthenticated: false,
      secret,
      otpauthUrl,
      qrCodeDataUrl
    };
  }

  setupAuth(secret, code) {
    const targetSecret = secret || this.pendingSetupSecret;
    if (!targetSecret) {
      return { success: false, error: 'Nessun segreto 2FA valido configurato.' };
    }
    if (verifyTotp(targetSecret, code)) {
      this.saveAuth(targetSecret);
      this.isAuthenticated = true;
      this.pendingSetupSecret = null;
      return { success: true };
    }
    return { success: false, error: 'Codice errato. Verifica l\'orario del dispositivo e riprova.' };
  }

  verifyAuthCode(code) {
    if (!this.authSecret) {
      return { success: false, error: '2FA non ancora configurato.' };
    }
    if (verifyTotp(this.authSecret, code)) {
      this.isAuthenticated = true;
      return { success: true };
    }
    return { success: false, error: 'Codice non valido o scaduto. Riprova.' };
  }
}

module.exports = {
  TaccuinoStore,
  base32Decode,
  base32Encode,
  generateRandomBase32,
  generateTotp,
  verifyTotp
};
