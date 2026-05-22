// PERHATIKAN: Variabel SPREADSHEET_ID dan GOOGLE_API_KEY sudah dihapus sepenuhnya dari sini!

export const SHEET_CONFIG = {
  current: { sheet_name: 'BoM1dice', is_current: true, is_ban: false },
  ban: { sheet_name: 'BanList', is_current: false, is_ban: true },
};

const HISTORY_PATTERN = /^BoM_(\d{2})-(\d{4})$/i;

async function fetchWithTimeout(url, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function parseHistorySheet(sheetName) {
  const m = sheetName.match(HISTORY_PATTERN);
  if (!m) return null;
  const monthNum = parseInt(m[1], 10);
  const year = m[2];
  if (monthNum < 1 || monthNum > 12) return null;
  return {
    sheet_name: sheetName,
    month: monthNum,
    year,
    sort_key: `${year}-${String(monthNum).padStart(2, '0')}`,
  };
}

export async function discoverHistorySheets() {
  try {
    // Memanggil Cloudflare Function lokal, BUKAN Google langsung
    const res = await fetch('/api/history'); 
    if (!res.ok) {
      console.warn('Sheets API failed:', res.status);
      return [];
    }
    const data = await res.json();
    const sheets = (data.sheets || []).map(s => s.properties.title);
    const history = sheets
      .map(name => parseHistorySheet(name))
      .filter(Boolean)
      .sort((a, b) => b.sort_key.localeCompare(a.sort_key));
    return history;
  } catch (err) {
    console.warn('discoverHistorySheets error:', err);
    return [];
  }
}

// Then replace all bare fetch() calls in api.js with fetchWithTimeout()
export async function fetchSheetCSV(sheetName) {
  const url = `/api/csv?sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${sheetName}`);
  return res.text();
}

export const VERIFIER_COLS = ['Nox', 'Akita', 'Sarci', 'Amanda'];