export const AUTO_S = 120;
export const CIRC = 62.83;

export const state = {
  allPlayers: [],
  displayed: [],
  sortState: { col: null, asc: true },
  activeFilter: 'all',
  bannedCount: 0,
  isLiverActive: false,
  cdLeft: AUTO_S,
  cdTimer: null,
  currentSheet: null,
  banSheet: null,
  historySheets: [],
  viewingHistory: null,
};
