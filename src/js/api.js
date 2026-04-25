const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const BASE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
const SHEETS_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${GOOGLE_API_KEY}&fields=sheets.properties`;

export const SHEET_CONFIG = {
  current: { sheet_name: 'BoM1dice', is_current: true, is_ban: false },
  ban: { sheet_name: 'BanList', is_current: false, is_ban: true },
};

const HISTORY_PATTERN = /^BoM_(\d{2})-(\d{4})$/i;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];

function parseHistorySheet(sheetName) {
  const m = sheetName.match(HISTORY_PATTERN);
  if (!m) return null;
  const monthNum = parseInt(m[1], 10);
  const year = m[2];
  if (monthNum < 1 || monthNum > 12) return null;
  return {
    sheet_name: sheetName,
    display_name: `${MONTH_NAMES[monthNum - 1]} ${year}`,
    sort_key: `${year}-${String(monthNum).padStart(2, '0')}`,
  };
}

export async function discoverHistorySheets() {
  try {
    const res = await fetch(SHEETS_API_URL);
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

export async function fetchSheetCSV(sheetName) {
  const url = `${BASE_CSV_URL}&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${sheetName}`);
  return res.text();
}
