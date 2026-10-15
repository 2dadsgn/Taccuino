import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IpcService } from './services/ipc.service';
import { Entry, EntryType, IncomeCategory, GetBalancesResponse } from '@contracts/models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  // Navigation State
  public selectedMonth: number = 10; // Ottobre
  public selectedYear: number = 2026;

  // Month names in Italian
  private monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // Data State
  public entries: Entry[] = [];
  public filteredEntries: Entry[] = [];
  public searchQuery: string = '';
  public isLoading: boolean = false;

  public balances: GetBalancesResponse = {
    bilancio_totale: 0,
    bilancio_mensile: 0,
    bilancio_annuale: 0,
    uscite_mensili: 0,
    entrate_mensili: 0,
    bilancio_totale_con_ectoplasma: 0,
    bilancio_mensile_con_ectoplasma: 0,
    bilancio_annuale_con_ectoplasma: 0,
    entrate_mensili_con_ectoplasma: 0,
    entrate_mensili_ectoplasma: 0
  };

  // Add Entry Modal State
  public isModalOpen: boolean = false;
  public newDate: string = '';
  public newNotes: string = '';
  public newAmount: number | null = null;
  public newType: EntryType = 'uscita';
  public isFiscoSelected: boolean = false;
  public isEctoplasmaSelected: boolean = false;
  public formError: string = '';

  // 2FA Google Authenticator State
  public isAuthenticated: boolean = false;
  public isAuthConfigured: boolean = false;
  public authSecret: string = '';
  public authQrCodeUrl: string = '';
  public authOtpauthUrl: string = '';
  public authInputCode: string = '';
  public authError: string = '';
  public isAuthLoading: boolean = true;
  public authKeyCopied: boolean = false;

  // Reset Database State (Double Confirmation)
  public isResetModalOpen: boolean = false;
  public resetStep: number = 1;
  public resetConfirmText: string = '';

  @ViewChild('csvFileInput') public csvFileInput!: ElementRef<HTMLInputElement>;

  constructor(private ipcService: IpcService) {}

  ngOnInit(): void {
    this.checkAuthStatus();
  }

  public checkAuthStatus(): void {
    this.isAuthLoading = true;
    this.ipcService.getAuthStatus().subscribe({
      next: (status) => {
        this.isAuthLoading = false;
        this.isAuthenticated = !!status.isAuthenticated;
        this.isAuthConfigured = !!status.isConfigured;
        if (!status.isConfigured) {
          this.authSecret = status.secret || '';
          this.authQrCodeUrl = status.qrCodeDataUrl || '';
          this.authOtpauthUrl = status.otpauthUrl || '';
        }
        if (this.isAuthenticated) {
          this.refreshAll();
        }
      },
      error: (err) => {
        console.error('Error fetching auth status:', err);
        this.isAuthLoading = false;
        this.isAuthenticated = true;
        this.refreshAll();
      }
    });
  }

  get currentMonthLabel(): string {
    return `${this.monthNames[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  public prevMonth(): void {
    if (this.selectedMonth === 1) {
      this.selectedMonth = 12;
      this.selectedYear--;
    } else {
      this.selectedMonth--;
    }
    this.refreshAll();
  }

  public nextMonth(): void {
    if (this.selectedMonth === 12) {
      this.selectedMonth = 1;
      this.selectedYear++;
    } else {
      this.selectedMonth++;
    }
    this.refreshAll();
  }

  public goToCurrentMonth(): void {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.refreshAll();
  }

  public refreshAll(): void {
    this.isLoading = true;

    // Load Entries
    this.ipcService.getEntries({
      month: this.selectedMonth,
      year: this.selectedYear
    }).subscribe({
      next: (res) => {
        this.entries = res.entries || [];
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching entries:', err);
        this.isLoading = false;
      }
    });

    // Load Balances
    this.ipcService.getBalances({
      month: this.selectedMonth,
      year: this.selectedYear
    }).subscribe({
      next: (res) => {
        this.balances = res;
      },
      error: (err) => {
        console.error('Error fetching balances:', err);
      }
    });
  }

  public onSearchChange(): void {
    this.applyFilter();
  }

  private applyFilter(): void {
    if (!this.searchQuery.trim()) {
      this.filteredEntries = [...this.entries];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filteredEntries = this.entries.filter(e => 
      e.notes.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.subType && e.subType.toLowerCase().includes(q)) ||
      e.date.includes(q)
    );
  }

  // Modal handlers
  public openAddModal(): void {
    // Default date matching selected month/year
    const day = '15';
    const mm = String(this.selectedMonth).padStart(2, '0');
    this.newDate = `${this.selectedYear}-${mm}-${day}`;
    this.newNotes = '';
    this.newAmount = null;
    this.newType = 'uscita';
    this.isFiscoSelected = true;
    this.isEctoplasmaSelected = false;
    this.formError = '';
    this.isModalOpen = true;
  }

  public closeModal(): void {
    this.isModalOpen = false;
  }

  public setEntryType(type: EntryType): void {
    this.newType = type;
    if (type === 'entrata' && !this.isFiscoSelected && !this.isEctoplasmaSelected) {
      this.isFiscoSelected = true;
      this.isEctoplasmaSelected = false;
    }
    this.formError = '';
  }

  public toggleFisco(): void {
    this.isFiscoSelected = true;
    this.isEctoplasmaSelected = false;
    this.formError = '';
  }

  public toggleEctoplasma(): void {
    this.isEctoplasmaSelected = true;
    this.isFiscoSelected = false;
    this.formError = '';
  }

  public submitEntry(): void {
    if (!this.newDate) {
      this.formError = 'Inserisci una data valida.';
      return;
    }
    if (!this.newNotes || !this.newNotes.trim()) {
      this.formError = 'Inserisci una descrizione o nota.';
      return;
    }
    if (this.newAmount === null || this.newAmount <= 0 || isNaN(this.newAmount)) {
      this.formError = 'Inserisci un importo valido maggiore di 0.';
      return;
    }

    if (this.newType === 'entrata' && !this.isFiscoSelected && !this.isEctoplasmaSelected) {
      this.formError = 'Per le entrate è obbligatorio selezionare Fisco oppure Ectoplasma.';
      return;
    }

    let category: IncomeCategory | undefined = undefined;
    if (this.newType === 'entrata') {
      category = this.isEctoplasmaSelected ? 'ectoplasma' : 'fisco';
    }

    this.formError = '';
    this.ipcService.addEntry({
      date: this.newDate,
      notes: this.newNotes.trim(),
      amount: Number(this.newAmount),
      type: this.newType,
      category,
      subType: category
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.closeModal();
          this.refreshAll();
        } else {
          this.formError = 'Errore durante il salvataggio.';
        }
      },
      error: (err) => {
        this.formError = 'Errore IPC: ' + (err.message || 'Impossibile salvare.');
      }
    });
  }

  public exportNotification: string = '';

  // Export Data to CSV
  public exportToCsv(): void {
    this.ipcService.getAllEntries().subscribe({
      next: (res) => {
        const dataToExport = res && res.entries && res.entries.length > 0 ? res.entries : this.entries;
        this.generateAndSaveCsv(dataToExport);
      },
      error: () => {
        this.generateAndSaveCsv(this.entries);
      }
    });
  }

  private generateAndSaveCsv(entries: Entry[]): void {
    const headers = ['ID', 'Data', 'Descrizione / Note', 'Importo (€)', 'Tipo Movimento', 'Categoria Entrata'];
    const rows = entries.map(e => [
      `"${e.id}"`,
      `"${this.formatDateDisplay(e.date)}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${Number(e.amount).toFixed(2)}"`,
      `"${e.type ? e.type.toUpperCase() : ''}"`,
      `"${e.type === 'entrata' ? (e.category || e.subType || 'fisco') : '-'}"`
    ]);

    // Use UTF-8 BOM so Microsoft Excel renders accents and € correctly
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const defaultFilename = `taccuino_export_${new Date().toISOString().slice(0, 10)}.csv`;

    if (this.ipcService.hasElectron() && (window as any).electronAPI.exportCsv) {
      (window as any).electronAPI.exportCsv({ csv: csvContent, defaultFilename }).then((result: any) => {
        if (result && result.success) {
          this.showExportNotification(`Esportato con successo in ${result.filePath}`);
        }
      }).catch((err: any) => {
        console.error('Electron export error, falling back to browser download:', err);
        this.fallbackBrowserDownload(csvContent, defaultFilename);
      });
    } else {
      this.fallbackBrowserDownload(csvContent, defaultFilename);
    }
  }

  private fallbackBrowserDownload(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showExportNotification('File CSV scaricato con successo');
  }

  private showExportNotification(msg: string): void {
    this.exportNotification = msg;
    setTimeout(() => {
      this.exportNotification = '';
    }, 4500);
  }

  // Import Data from CSV
  public importFromCsv(): void {
    if (this.ipcService.hasElectron() && (window as any).electronAPI.importCsv) {
      this.ipcService.importCsv().subscribe({
        next: (res) => {
          if (res && res.success) {
            this.showExportNotification(`Importate con successo ${res.importedCount} voci da CSV`);
            this.refreshAll();
          } else if (res && res.error) {
            this.showExportNotification(`Errore importazione: ${res.error}`);
          }
        },
        error: (err) => {
          console.error('Electron import error, falling back to browser picker:', err);
          this.triggerBrowserFileInput();
        }
      });
    } else {
      this.triggerBrowserFileInput();
    }
  }

  private triggerBrowserFileInput(): void {
    if (this.csvFileInput && this.csvFileInput.nativeElement) {
      this.csvFileInput.nativeElement.value = '';
      this.csvFileInput.nativeElement.click();
    }
  }

  public onFileSelected(event: any): void {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const content = e.target.result;
      if (typeof content === 'string') {
        this.ipcService.importCsv({ csvContent: content }).subscribe({
          next: (res) => {
            if (res && res.success) {
              this.showExportNotification(`Importate con successo ${res.importedCount} voci da CSV`);
              this.refreshAll();
            } else {
              this.showExportNotification(`Errore: ${res.error || 'Impossibile importare CSV'}`);
            }
          },
          error: (err) => {
            this.showExportNotification(`Errore: ${err.message || 'Errore durante la lettura del CSV'}`);
          }
        });
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  // 2FA Google Authenticator Methods
  public submitAuthSetup(): void {
    this.authError = '';
    const code = (this.authInputCode || '').trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      this.authError = 'Inserisci un codice valido a 6 cifre.';
      return;
    }

    this.ipcService.setupAuth({
      secret: this.authSecret,
      code
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.isAuthenticated = true;
          this.isAuthConfigured = true;
          this.authInputCode = '';
          this.showExportNotification('Google Authenticator configurato con successo!');
          this.refreshAll();
        } else {
          this.authError = res.error || 'Codice errato. Riprova.';
        }
      },
      error: (err) => {
        this.authError = err.message || 'Errore durante la verifica del codice.';
      }
    });
  }

  public submitAuthLogin(): void {
    this.authError = '';
    const code = (this.authInputCode || '').trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      this.authError = 'Inserisci un codice valido a 6 cifre.';
      return;
    }

    this.ipcService.verifyAuthCode({ code }).subscribe({
      next: (res) => {
        if (res.success) {
          this.isAuthenticated = true;
          this.authInputCode = '';
          this.showExportNotification('Accesso consentito.');
          this.refreshAll();
        } else {
          this.authError = res.error || 'Codice non valido o scaduto. Riprova.';
        }
      },
      error: (err) => {
        this.authError = err.message || 'Errore durante la verifica del codice.';
      }
    });
  }

  public copyAuthSecret(): void {
    if (navigator && navigator.clipboard && this.authSecret) {
      navigator.clipboard.writeText(this.authSecret);
      this.authKeyCopied = true;
      setTimeout(() => {
        this.authKeyCopied = false;
      }, 3000);
    }
  }

  // Delete Single Entry
  public deleteEntry(entry: Entry, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!entry || !entry.id) return;
    this.ipcService.deleteEntry({ id: entry.id }).subscribe({
      next: (res) => {
        if (res.success) {
          this.showExportNotification(`Voce "${entry.notes}" eliminata.`);
          this.refreshAll();
        } else {
          this.showExportNotification(`Errore: ${res.error || 'Impossibile eliminare la voce'}`);
        }
      },
      error: (err) => {
        this.showExportNotification(`Errore: ${err.message || 'Impossibile eliminare la voce'}`);
      }
    });
  }

  // Reset Entire Database (Double Confirmation)
  public openResetModal(): void {
    this.isResetModalOpen = true;
    this.resetStep = 1;
    this.resetConfirmText = '';
  }

  public closeResetModal(): void {
    this.isResetModalOpen = false;
    this.resetStep = 1;
    this.resetConfirmText = '';
  }

  public proceedToResetStep2(): void {
    this.resetStep = 2;
    this.resetConfirmText = '';
  }

  public executeDatabaseReset(): void {
    if (this.resetConfirmText.trim().toUpperCase() !== 'CONFERMA') {
      return;
    }
    this.ipcService.resetDatabase().subscribe({
      next: (res) => {
        if (res.success) {
          this.closeResetModal();
          this.refreshAll();
          this.showExportNotification('Database azzerato con successo.');
        } else {
          this.showExportNotification(`Errore reset: ${res.error || 'Operazione fallita'}`);
        }
      },
      error: (err) => {
        this.showExportNotification(`Errore reset: ${err.message || 'Operazione fallita'}`);
      }
    });
  }

  // Formatting helpers
  public formatCurrency(val: number): string {
    if (val === undefined || val === null || isNaN(val)) {
      return '€ 0,00';
    }
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    const parts = absVal.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}€ ${parts.join(',')}`;
  }

  public formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }
}
