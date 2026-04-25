const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const BASE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;

export const SHEET_CONFIG = {
  current: { sheet_name: 'BoM1dice', is_current: true, is_ban: false },
  ban: { sheet_name: 'BanList', is_current: false, is_ban: true },
  history: [
    // Add history sheets here, e.g.:
    // { sheet_name: 'BoM_Apr-2026', display_name: 'April 2026', is_current: false, is_ban: false },
  ],
};


export async function fetchSheetCSV(sheetName) {
  const url = `${BASE_CSV_URL}&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${sheetName}`);
  return res.text();
}
