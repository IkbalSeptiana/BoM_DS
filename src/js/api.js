const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const BASE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
const SHEETS_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${GOOGLE_API_KEY}&fields=sheets.properties`;

export const SHEET_CONFIG = {
  current: { sheet_name: 'BoM1dice', is_current: true, is_ban: false },
  ban: { sheet_name: 'BanList', is_current: false, is_ban: true },
};

const HISTORY_PATTERN = /^BoM[_\s](\w{3})-(\d{4})$/i;
const MONTH_NAMES = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April',
  may: 'May', jun: 'June', jul: 'July', aug: 'August',
  sep: 'September', oct: 'October', nov: 'November', dec: 'December',
};

function parseHistorySheet(sheetName) {
  const m = sheetName.match(HISTORY_PATTERN);
  if (!m) return null;
  const monthKey = m[1].toLowerCase();
  const year = m[2];
  const monthName = MONTH_NAMES[monthKey] || m[1];
  return {
    sheet_name: sheetName,
    display_name: `${monthName} ${year}`,
    sort_key: `${year}-${String(Object.keys(MONTH_NAMES).indexOf(monthKey) + 1).padStart(2, '0')}`,
  };
}

export async function discoverHistorySheets() {
  try {
    const res = await fetch(SHEETS_API_URL);
    if (!res.ok) return [];
    const data = await res.json();
    const sheets = (data.sheets || []).map(s => s.properties.title);
    return sheets
      .map(name => parseHistorySheet(name))
      .filter(Boolean)
      .sort((a, b) => b.sort_key.localeCompare(a.sort_key));
  } catch {
    return [];
  }
}

export async function fetchSheetCSV(sheetName) {
  const url = `${BASE_CSV_URL}&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${sheetName}`);
  return res.text();
}
