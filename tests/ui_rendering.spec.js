const fs = require('fs');
const path = require('path');

function runUiRenderingTests() {
  const results = [];

  function assert(testName, condition, detail = '') {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: detail });
    }
  }

  // 1. Build Artifact Existence
  const distHtmlPath = path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'index.html');
  assert('Production bundle index.html exists', fs.existsSync(distHtmlPath), `Missing: ${distHtmlPath}`);

  if (fs.existsSync(distHtmlPath)) {
    const html = fs.readFileSync(distHtmlPath, 'utf8');
    assert('Index contains app-root element', html.includes('<app-root></app-root>'));
    assert('Index defines relative base href', html.includes('<base href="./">'));
    assert('Index includes Google Fonts Inter/Outfit', html.includes('fonts.googleapis.com'));
  }

  // 2. Component Template Wireframe Element Verification
  const templatePath = path.join(__dirname, '..', 'frontend', 'src', 'app', 'app.component.html');
  assert('AppComponent template exists', fs.existsSync(templatePath), `Missing: ${templatePath}`);

  if (fs.existsSync(templatePath)) {
    const tmpl = fs.readFileSync(templatePath, 'utf8');

    // Sidebar assertions
    assert('UI renders RIEPILOGO sidebar container', tmpl.includes('id="sidebar-riepilogo"'));
    assert('UI renders Bilancio Totale card', tmpl.includes('id="card-bilancio-totale"'));
    assert('UI renders Bilancio Annuale card', tmpl.includes('id="card-bilancio-annuale"'));
    assert('UI renders Bilancio Mensile card', tmpl.includes('id="card-bilancio-mensile"'));
    assert('UI renders Entrate Mensili card', tmpl.includes('id="card-entrate-mensili"'));
    assert('UI renders Uscite Mensili card', tmpl.includes('id="card-uscite-mensili"'));

    // Navigation assertions
    assert('UI renders Month Navigator bar', tmpl.includes('id="month-navigator"'));
    assert('UI renders Previous Month button', tmpl.includes('id="btn-prev-month"'));
    assert('UI renders Next Month button', tmpl.includes('id="btn-next-month"'));
    assert('UI renders Current Month Label', tmpl.includes('id="label-current-month"'));
    assert('UI renders Today shortcut button', tmpl.includes('id="btn-today"'));
    assert('UI renders Search box', tmpl.includes('id="input-search"'));

    // Central entries table assertions
    assert('UI renders entries table container', tmpl.includes('id="entries-list-container"'));
    assert('UI renders entries rows list', tmpl.includes('id="entries-rows"'));
    assert('UI supports ENTRATA and USCITA row styling', tmpl.includes('row-entrata') && tmpl.includes('row-uscita'));

    // Floating action button assertions
    assert('UI renders Floating Action Button [+]', tmpl.includes('id="fab-add-entry"'));

    // Modal dialog assertions
    assert('UI renders Add Entry Modal dialog', tmpl.includes('id="modal-add-entry"'));
    assert('Modal contains Date input', tmpl.includes('id="input-entry-date"'));
    assert('Modal contains Notes input', tmpl.includes('id="input-entry-notes"'));
    assert('Modal contains Amount input', tmpl.includes('id="input-entry-amount"'));
    assert('Modal contains Entrata type toggle', tmpl.includes('id="type-entrata-btn"'));
    assert('Modal contains Uscita type toggle', tmpl.includes('id="type-uscita-btn"'));
    assert('Modal contains Fisco subtype button', tmpl.includes('id="type-fisco-btn"'));
    assert('Modal contains Ectoplasma subtype button', tmpl.includes('id="type-ectoplasma-btn"'));
    assert('UI template does not contain badge-both', !tmpl.includes('badge-both'));
    assert('UI template indicates mandatory Fisco or Ectoplasma choice', tmpl.includes('obbligatorio: Fisco oppure Ectoplasma'));
    assert('Modal contains Save button', tmpl.includes('id="btn-save"'));
    assert('Modal contains Cancel button', tmpl.includes('id="btn-cancel"'));

    // Sub-balance display assertions
    assert('Sidebar renders Total balance ectoplasma sub-field', tmpl.includes('id="sub-bilancio-totale-ectoplasma"'));
    assert('Sidebar renders Annual balance ectoplasma sub-field', tmpl.includes('id="sub-bilancio-annuale-ectoplasma"'));
    assert('Sidebar renders Monthly balance ectoplasma sub-field', tmpl.includes('id="sub-bilancio-mensile-ectoplasma"'));

    // Export & Import CSV button assertions
    assert('UI renders Export CSV button', tmpl.includes('id="btn-export-csv"'));
    assert('UI renders Import CSV button', tmpl.includes('id="btn-import-csv"'));
    assert('UI renders hidden CSV file input', tmpl.includes('id="csv-file-input"'));
    assert('UI renders Export Toast container', tmpl.includes('id="export-toast"'));

    // Reset Database and Entry Deletion assertions
    assert('UI renders Reset DB button', tmpl.includes('id="btn-reset-db"'));
    assert('UI renders delete button on entries', tmpl.includes('class="btn-delete-entry"'));
    assert('UI renders Reset Database confirmation modal', tmpl.includes('id="modal-reset-confirm"'));
    assert('UI renders Reset confirmation text input', tmpl.includes('id="input-reset-confirmation"'));
    assert('UI renders final reset confirmation button', tmpl.includes('id="btn-reset-final-confirm"'));

    // 2FA Google Authenticator assertions
    assert('UI renders 2FA Google Authenticator page container', tmpl.includes('id="auth-page-container"'));
    assert('UI renders 2FA 6-digit code input', tmpl.includes('id="input-auth-code"'));
    assert('UI renders 2FA setup verify button', tmpl.includes('id="btn-verify-setup"'));
    assert('UI renders 2FA login verify button', tmpl.includes('id="btn-verify-login"'));
    assert('UI renders 2FA QR code element', tmpl.includes('id="auth-qr-code"'));
  }

  // 3. Styling & Aesthetics Verification
  const cssPath = path.join(__dirname, '..', 'frontend', 'src', 'app', 'app.component.css');
  assert('AppComponent stylesheet exists', fs.existsSync(cssPath));
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    assert('Styles define floating action button position and animation', css.includes('.floating-action-button'));
    assert('Styles define modal backdrop blur and animation', css.includes('.modal-backdrop') && css.includes('backdrop-filter'));
    assert('Styles define positive/negative card states', css.includes('.balance-card.monthly.positive') && css.includes('.balance-card.monthly.negative'));
    assert('Styles define Fisco button active state', css.includes('.active-fisco'));
    assert('Styles define Ectoplasma button active state', css.includes('.active-ectoplasma'));
    assert('Styles define sub-balance row layout', css.includes('.sub-balance-row'));
    assert('Styles define Export CSV button styling', css.includes('.header-action-btn'));
    assert('Styles define danger action header button', css.includes('.btn-danger-action'));
    assert('Styles define entry delete button hover animation', css.includes('.btn-delete-entry'));
    assert('Styles define 2FA authentication card and overlay', css.includes('.auth-overlay-backdrop') && css.includes('.auth-card'));
  }

  return results;
}

module.exports = { runUiRenderingTests };
