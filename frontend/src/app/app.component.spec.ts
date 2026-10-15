import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { IpcService } from './services/ipc.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [FormsModule],
      providers: [IpcService]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render sidebar header RIEPILOGO', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#sidebar-riepilogo h2')?.textContent?.trim()).toEqual('RIEPILOGO');
  });

  it('should display October 2026 by default', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#label-current-month')?.textContent?.trim()).toContain('Ottobre 2026');
  });

  it('should open modal when openAddModal is invoked', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.isModalOpen).toBeFalse();
    app.openAddModal();
    expect(app.isModalOpen).toBeTrue();
  });

  it('should navigate month backwards and forwards', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.selectedMonth = 10;
    app.selectedYear = 2026;
    app.prevMonth();
    expect(app.selectedMonth).toBe(9);
    app.nextMonth();
    expect(app.selectedMonth).toBe(10);
  });
});
