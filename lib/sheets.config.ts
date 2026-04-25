// Add history sheet names here as you create them.
// Pattern: copy BoM1dice sheet → rename to BoM_MM-YYYY → add to this list.
export const HISTORY_SHEETS: string[] = [
  // "BoM_04-2026",
  // "BoM_05-2026",
];

export const MAIN_SHEET  = process.env.MAIN_SHEET  || 'BoM1dice';
export const BAN_SHEET   = process.env.BAN_SHEET   || 'BAN LIST';
export const SHEET_ID    = process.env.SPREADSHEET_ID || '1k8UGq5PfAKu7FWmh4klPYCMUy___ju484_eDfaWolbM';
