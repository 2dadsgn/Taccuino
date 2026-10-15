export type EntryType = 'entrata' | 'uscita';
export type IncomeCategory = 'fisco' | 'ectoplasma';

export interface Entry {
  id: string;
  date: string; // Format: YYYY-MM-DD or DD/MM/YYYY
  notes: string;
  amount: number;
  type: EntryType;
  category?: IncomeCategory;
  subType?: IncomeCategory;
}

export interface GetEntriesRequest {
  month: number; // 1-12
  year: number;
}

export interface GetEntriesResponse {
  entries: Entry[];
}

export interface AddEntryRequest {
  date: string;
  notes: string;
  amount: number;
  type: EntryType;
  category?: IncomeCategory;
  subType?: IncomeCategory;
}

export interface AddEntryResponse {
  success: boolean;
  id: string;
}

export interface GetBalancesRequest {
  month: number; // 1-12
  year: number;
}

export interface GetBalancesResponse {
  bilancio_totale: number;
  bilancio_mensile: number;
  bilancio_annuale: number;
  uscite_mensili: number;
  entrate_mensili: number;
  bilancio_totale_con_ectoplasma: number;
  bilancio_mensile_con_ectoplasma: number;
  bilancio_annuale_con_ectoplasma: number;
  entrate_mensili_con_ectoplasma?: number;
  entrate_mensili_ectoplasma?: number;
}

export interface GetAllEntriesResponse {
  entries: Entry[];
}

export interface ExportCsvRequest {
  csv: string;
  defaultFilename?: string;
}

export interface ExportCsvResponse {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export interface ImportCsvRequest {
  csvContent?: string;
}

export interface ImportCsvResponse {
  success: boolean;
  importedCount: number;
  canceled?: boolean;
  error?: string;
  filePath?: string;
}

export interface DeleteEntryRequest {
  id: string;
}

export interface DeleteEntryResponse {
  success: boolean;
  error?: string;
}

export interface ResetDatabaseResponse {
  success: boolean;
  error?: string;
}

export interface GetAuthStatusResponse {
  isConfigured: boolean;
  isAuthenticated: boolean;
  secret?: string;
  otpauthUrl?: string;
  qrCodeDataUrl?: string;
}

export interface SetupAuthRequest {
  secret: string;
  code: string;
}

export interface SetupAuthResponse {
  success: boolean;
  error?: string;
}

export interface VerifyAuthCodeRequest {
  code: string;
}

export interface VerifyAuthCodeResponse {
  success: boolean;
  error?: string;
}

export interface ElectronIpcBridge {
  getEntries(request: GetEntriesRequest): Promise<GetEntriesResponse>;
  getAllEntries?(): Promise<GetAllEntriesResponse>;
  addEntry(request: AddEntryRequest): Promise<AddEntryResponse>;
  deleteEntry?(request: DeleteEntryRequest): Promise<DeleteEntryResponse>;
  resetDatabase?(): Promise<ResetDatabaseResponse>;
  getBalances(request: GetBalancesRequest): Promise<GetBalancesResponse>;
  exportCsv?(request: ExportCsvRequest): Promise<ExportCsvResponse>;
  importCsv?(request?: ImportCsvRequest): Promise<ImportCsvResponse>;
  getAuthStatus?(): Promise<GetAuthStatusResponse>;
  setupAuth?(request: SetupAuthRequest): Promise<SetupAuthResponse>;
  verifyAuthCode?(request: VerifyAuthCodeRequest): Promise<VerifyAuthCodeResponse>;
}

declare global {
  interface Window {
    electronAPI?: ElectronIpcBridge;
  }
}
