import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import {
  Entry,
  GetEntriesRequest,
  GetEntriesResponse,
  GetAllEntriesResponse,
  AddEntryRequest,
  AddEntryResponse,
  GetBalancesRequest,
  GetBalancesResponse,
  ExportCsvRequest,
  ExportCsvResponse,
  ImportCsvRequest,
  ImportCsvResponse,
  DeleteEntryRequest,
  DeleteEntryResponse,
  ResetDatabaseResponse,
  GetAuthStatusResponse,
  SetupAuthRequest,
  SetupAuthResponse,
  VerifyAuthCodeRequest,
  VerifyAuthCodeResponse
} from '@contracts/models';

@Injectable({
  providedIn: 'root'
})
export class IpcService {
  // Clean in-memory state (no mock data packaged)
  private mockEntries: Entry[] = [];
  private mockAuthSecret: string | null = null;
  private mockIsAuthenticated: boolean = false;

  constructor() {}

  public hasElectron(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI;
  }

  public getAllEntries(): Observable<GetAllEntriesResponse> {
    if (this.hasElectron() && (window as any).electronAPI.getAllEntries) {
      return from((window as any).electronAPI.getAllEntries() as Promise<GetAllEntriesResponse>);
    }
    return of({ entries: [...this.mockEntries] });
  }

  public getEntries(req: GetEntriesRequest): Observable<GetEntriesResponse> {
    if (this.hasElectron()) {
      return from((window as any).electronAPI.getEntries(req) as Promise<GetEntriesResponse>);
    }

    // Fallback filter by month and year
    const filtered = this.mockEntries.filter(item => {
      const d = new Date(item.date);
      return d.getMonth() + 1 === req.month && d.getFullYear() === req.year;
    });

    return of({ entries: [...filtered] });
  }

  public addEntry(req: AddEntryRequest): Observable<AddEntryResponse> {
    if (this.hasElectron()) {
      return from((window as any).electronAPI.addEntry(req) as Promise<AddEntryResponse>);
    }

    const isEntrata = req.type === 'entrata';
    const cat = isEntrata ? (req.subType || req.category || 'fisco') : undefined;
    const newEntry: Entry = {
      id: 'e-' + Date.now(),
      date: req.date,
      notes: req.notes,
      amount: req.amount,
      type: req.type,
      category: cat,
      subType: cat
    };

    this.mockEntries.push(newEntry);
    return of({ success: true, id: newEntry.id });
  }

  public deleteEntry(req: DeleteEntryRequest): Observable<DeleteEntryResponse> {
    if (this.hasElectron() && (window as any).electronAPI.deleteEntry) {
      return from((window as any).electronAPI.deleteEntry(req) as Promise<DeleteEntryResponse>);
    }

    const idx = this.mockEntries.findIndex(e => e.id === req.id);
    if (idx !== -1) {
      this.mockEntries.splice(idx, 1);
      return of({ success: true });
    }
    return of({ success: false, error: 'Voce non trovata.' });
  }

  public resetDatabase(): Observable<ResetDatabaseResponse> {
    if (this.hasElectron() && (window as any).electronAPI.resetDatabase) {
      return from((window as any).electronAPI.resetDatabase() as Promise<ResetDatabaseResponse>);
    }

    this.mockEntries = [];
    return of({ success: true });
  }

  public getAuthStatus(): Observable<GetAuthStatusResponse> {
    if (this.hasElectron() && (window as any).electronAPI.getAuthStatus) {
      return from((window as any).electronAPI.getAuthStatus() as Promise<GetAuthStatusResponse>);
    }

    if (this.mockAuthSecret) {
      return of({
        isConfigured: true,
        isAuthenticated: this.mockIsAuthenticated
      });
    }

    return of({
      isConfigured: false,
      isAuthenticated: false,
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl: 'otpauth://totp/Taccuino:Utente?secret=JBSWY3DPEHPK3PXP&issuer=Taccuino'
    });
  }

  public setupAuth(req: SetupAuthRequest): Observable<SetupAuthResponse> {
    if (this.hasElectron() && (window as any).electronAPI.setupAuth) {
      return from((window as any).electronAPI.setupAuth(req) as Promise<SetupAuthResponse>);
    }

    if (req.code && req.code.trim().length === 6) {
      this.mockAuthSecret = req.secret;
      this.mockIsAuthenticated = true;
      return of({ success: true });
    }
    return of({ success: false, error: 'Codice non valido. Inserisci 6 cifre.' });
  }

  public verifyAuthCode(req: VerifyAuthCodeRequest): Observable<VerifyAuthCodeResponse> {
    if (this.hasElectron() && (window as any).electronAPI.verifyAuthCode) {
      return from((window as any).electronAPI.verifyAuthCode(req) as Promise<VerifyAuthCodeResponse>);
    }

    if (req.code && req.code.trim().length === 6) {
      this.mockIsAuthenticated = true;
      return of({ success: true });
    }
    return of({ success: false, error: 'Codice non valido o scaduto.' });
  }

  public getBalances(req: GetBalancesRequest): Observable<GetBalancesResponse> {
    if (this.hasElectron()) {
      return from((window as any).electronAPI.getBalances(req) as Promise<GetBalancesResponse>);
    }

    let fiscoTotale = 0;
    let ectoTotale = 0;
    let usciteTotale = 0;

    let fiscoAnnuale = 0;
    let ectoAnnuale = 0;
    let usciteAnnuale = 0;

    let fiscoMensile = 0;
    let ectoMensile = 0;
    let usciteMensile = 0;

    for (const item of this.mockEntries) {
      const d = new Date(item.date);
      const isCurrentMonth = (d.getMonth() + 1 === req.month) && (d.getFullYear() === req.year);
      const isCurrentYear = d.getFullYear() === req.year;

      if (item.type === 'entrata') {
        const cat = item.category || item.subType || 'fisco';
        if (cat === 'ectoplasma') {
          ectoTotale += item.amount;
          if (isCurrentYear) {
            ectoAnnuale += item.amount;
          }
          if (isCurrentMonth) {
            ectoMensile += item.amount;
          }
        } else {
          fiscoTotale += item.amount;
          if (isCurrentYear) {
            fiscoAnnuale += item.amount;
          }
          if (isCurrentMonth) {
            fiscoMensile += item.amount;
          }
        }
      } else {
        usciteTotale += item.amount;
        if (isCurrentYear) {
          usciteAnnuale += item.amount;
        }
        if (isCurrentMonth) {
          usciteMensile += item.amount;
        }
      }
    }

    const bilancioTotaleFisco = fiscoTotale - usciteTotale;
    const bilancioAnnualeFisco = fiscoAnnuale - usciteAnnuale;
    const bilancioMensileFisco = fiscoMensile - usciteMensile;

    const bilancioTotaleConEcto = (fiscoTotale + ectoTotale) - usciteTotale;
    const bilancioAnnualeConEcto = (fiscoAnnuale + ectoAnnuale) - usciteAnnuale;
    const bilancioMensileConEcto = (fiscoMensile + ectoMensile) - usciteMensile;

    return of({
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
    });
  }

  public importCsv(req?: ImportCsvRequest): Observable<ImportCsvResponse> {
    if (this.hasElectron() && (window as any).electronAPI.importCsv) {
      return from((window as any).electronAPI.importCsv(req) as Promise<ImportCsvResponse>);
    }

    if (req && req.csvContent) {
      const count = this.parseAndImportBrowserCsv(req.csvContent);
      return of({ success: true, importedCount: count });
    }

    return of({ success: false, importedCount: 0, error: 'Nessun file o contenuto specificato.' });
  }

  private parseAndImportBrowserCsv(content: string): number {
    const raw = content.replace(/^\uFEFF/, '').trim();
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return 0;

    const firstLine = lines[0];
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const cells: string[] = [];
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
          cells.push(cell.trim().replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"'));
          cell = '';
        } else {
          cell += char;
        }
      }
      cells.push(cell.trim().replace(/^"/, '').replace(/"$/, '').replace(/""/g, '"'));
      return cells;
    };

    const firstCells = parseLine(firstLine);
    const colMap = { date: -1, notes: -1, amount: -1, type: -1, category: -1, id: -1 };
    firstCells.forEach((h, idx) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean === 'id') colMap.id = idx;
      else if (clean.includes('data') || clean.includes('date')) colMap.date = idx;
      else if (clean.includes('desc') || clean.includes('note')) colMap.notes = idx;
      else if (clean.includes('import') || clean.includes('amount')) colMap.amount = idx;
      else if (clean.includes('tipo') || clean.includes('type')) colMap.type = idx;
      else if (clean.includes('cat') || clean.includes('fisco') || clean.includes('ecto')) colMap.category = idx;
    });

    const hasHeader = colMap.date !== -1 || colMap.amount !== -1;
    const startIndex = hasHeader ? 1 : 0;
    let count = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cells = parseLine(lines[i]);
      if (cells.length < 2) continue;

      let date = hasHeader && colMap.date !== -1 ? cells[colMap.date] : cells[0];
      let notes = hasHeader && colMap.notes !== -1 ? cells[colMap.notes] : (cells[1] || '');
      let amountStr = hasHeader && colMap.amount !== -1 ? cells[colMap.amount] : (cells[2] || '0');
      let typeStr = hasHeader && colMap.type !== -1 ? cells[colMap.type] : (cells[3] || '');
      let catStr = hasHeader && colMap.category !== -1 ? cells[colMap.category] : (cells[4] || '');

      let s = amountStr.replace(/[€$£\s]/g, '');
      if (s.includes(',') && s.includes('.')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      const amount = Math.abs(parseFloat(s)) || 0;
      const isEntrata = typeStr.toLowerCase().includes('entrat') || typeStr.toLowerCase().includes('in');
      let cat: any = undefined;
      if (isEntrata) {
        if (catStr.toLowerCase().includes('ecto')) cat = 'ectoplasma';
        else cat = 'fisco';
      }

      if (date) {
        if (date.includes('/')) {
          const parts = date.split('/');
          if (parts.length === 3 && parts[2].length === 4) {
            date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const entry: Entry = {
          id: 'imp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          date,
          notes,
          amount,
          type: isEntrata ? 'entrata' : 'uscita',
          category: cat,
          subType: cat
        };
        this.mockEntries.push(entry);
        count++;
      }
    }
    return count;
  }
}
