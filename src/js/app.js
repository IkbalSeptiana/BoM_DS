import { t, setLang, getLang, applyAll, getAvailableLangs } from '../i18n/index.js';
import { SHEET_CONFIG, fetchSheetCSV, discoverHistorySheets } from './api.js';
import { parseCSV, processBanData, processMainData } from './parser.js';
import { state } from './state.js';
import {
  renderTable, renderBanTable, updateStats, populateAlliances,
  startCountdown, renderHistoryNav
} from './ui.js';

/* ── Modals ── */
function toggleRules() {
  const modal = document.getElementById('rulesModal');
  const isOpen = modal.classList.toggle('open');
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (!isOpen) {
    const iframe = modal.querySelector('iframe');
    if (iframe) { iframe.src = iframe.src; }
  }
}

function toggleBanModal() {
  const modal = document.getElementById('banModal');
  const isOpen = modal.classList.toggle('open');
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeOutside(e) {
  if (e.target === document.getElementById('rulesModal')) toggleRules();
}

function closeBanOutside(e) {
  if (e.target === document.getElementById('banModal')) toggleBanModal();
}

/* ── Filters ── */
function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const ali = document.getElementById('allianceFilter').value.trim().toLowerCase();

  state.displayed = state.allPlayers.filter(r => {
    const blob = ((r.Player || '') + ' ' + (r['Player ID'] || '') + ' ' + (r.Alliance || '')).toLowerCase();
    const qOk = !q || blob.includes(q);
    const aOk = !ali || (r.Alliance || '').trim().toLowerCase() === ali;

    let sOk = false;
    if (state.activeFilter === 'all') sOk = true;
    else if (state.activeFilter === 'sponsored') sOk = r._sponsoredBy !== null;
    else if (state.activeFilter === 'sponsoring') sOk = r._sponsoringTargets && r._sponsoringTargets.length > 0;
    else sOk = r._status === state.activeFilter;

    return qOk && aOk && sOk;
  });

  if (state.sortState.col) sortArr(state.sortState.col, state.sortState.asc);
  renderTable();
}

function setFilter(f, btn) {
  state.activeFilter = f;
  document.querySelectorAll('.ftab[data-filter]').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  applyFilters();
}

function handleSort(col) {
  state.sortState = state.sortState.col === col
    ? { col, asc: !state.sortState.asc }
    : { col, asc: true };
  document.querySelectorAll('.si').forEach(ic => { ic.textContent = '⇕'; ic.classList.remove('on'); });
  const ic = document.getElementById('si-' + col);
  if (ic) { ic.textContent = state.sortState.asc ? '▲' : '▼'; ic.classList.add('on'); }
  sortArr(state.sortState.col, state.sortState.asc);
  renderTable();
}

function sortArr(col, asc) {
  state.displayed.sort((a, b) => {
    const va = (a[col] || '').toString().toLowerCase();
    const vb = (b[col] || '').toString().toLowerCase();
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

/* ── Data Fetching ── */
async function fetchData(spinner = false) {
  if (spinner) {
    document.getElementById('rf-icon').classList.add('spin');
    document.getElementById('tbody').innerHTML = `<tr class="nodata"><td colspan="7">${t('fetching')}</td></tr>`;
  }

  try {
    const mainSheet = state.currentSheet ? state.currentSheet.sheet_name : 'BoM1dice';
    const banSheet = state.banSheet ? state.banSheet.sheet_name : 'BanList';

    const [mainCSV, banCSV] = await Promise.all([
      fetchSheetCSV(mainSheet),
      fetchSheetCSV(banSheet)
    ]);

    const [mainRes, banRes] = await Promise.all([parseCSV(mainCSV), parseCSV(banCSV)]);

    const { banMap, bannedCount } = processBanData(banRes.data);
    state.bannedCount = bannedCount;
    renderBanTable(banMap);

    const { players, isLiverActive } = processMainData(mainRes.data);
    state.allPlayers = players;
    state.isLiverActive = isLiverActive;

    document.getElementById('col-pack-title').textContent = isLiverActive ? t('colPacks') : t('colCommitment');

    populateAlliances();
    applyFilters();
    updateStats();

    const time = new Date();
    document.getElementById('last-sync').textContent = t('lastSync') + ' ' + time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('rf-icon').classList.remove('spin');
    startCountdown(fetchData);
  } catch (err) {
    document.getElementById('rf-icon').classList.remove('spin');
    document.getElementById('tbody').innerHTML = `<tr class="nodata"><td colspan="7" style="color:var(--red)">${t('fetchFailed')}</td></tr>`;
  }
}

async function fetchHistoryData(sheetName) {
  document.getElementById('rf-icon').classList.add('spin');
  document.getElementById('tbody').innerHTML = `<tr class="nodata"><td colspan="7">${t('fetching')}</td></tr>`;

  try {
    const csv = await fetchSheetCSV(sheetName);
    const res = await parseCSV(csv);
    const { players, isLiverActive } = processMainData(res.data);

    state.allPlayers = players;
    state.isLiverActive = isLiverActive;
    state.activeFilter = 'all';
    document.querySelectorAll('.ftab[data-filter]').forEach(b => b.classList.remove('on'));
    document.querySelector('.ftab[data-filter="all"]').classList.add('on');

    document.getElementById('col-pack-title').textContent = isLiverActive ? t('colPacks') : t('colCommitment');

    populateAlliances();
    applyFilters();
    updateStats();

    document.getElementById('rf-icon').classList.remove('spin');
  } catch (err) {
    document.getElementById('rf-icon').classList.remove('spin');
    document.getElementById('tbody').innerHTML = `<tr class="nodata"><td colspan="7" style="color:var(--red)">${t('fetchFailed')}</td></tr>`;
  }
}

/* ── Language Switcher ── */
function buildLangSwitcher() {
  const container = document.getElementById('lang-switcher');
  if (!container) return;
  container.innerHTML = '';
  const langs = getAvailableLangs();
  const current = getLang();

  langs.forEach(({ code, name }) => {
    const btn = document.createElement('button');
    btn.className = `ftab ${code === current ? 'on' : ''}`;
    btn.textContent = name;
    btn.onclick = () => {
      setLang(code);
      buildLangSwitcher();
      populateAlliances();
      applyFilters();
      updateStats();
      renderHistoryNav(fetchData, fetchHistoryData);
      document.getElementById('col-pack-title').textContent = state.isLiverActive ? t('colPacks') : t('colCommitment');
      document.getElementById('langModal').classList.remove('open');
      document.body.style.overflow = '';
    };
    container.appendChild(btn);
  });
}

/* ── Back to Top ── */
function setupBackToTop() {
  const btn = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) btn.classList.add('show');
    else btn.classList.remove('show');
  });
}

/* ── Init ── */
export async function init() {
  // Expose functions to HTML onclick handlers
  window.toggleRules = toggleRules;
  window.toggleBanModal = toggleBanModal;
  window.closeOutside = closeOutside;
  window.closeBanOutside = closeBanOutside;
  window.applyFilters = applyFilters;
  window.setFilter = setFilter;
  window.handleSort = handleSort;
  window.fetchData = fetchData;
  window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Apply language
  applyAll();
  buildLangSwitcher();
  setupBackToTop();

  // Load sheet config
  state.currentSheet = SHEET_CONFIG.current;
  state.banSheet = SHEET_CONFIG.ban;

  // Auto-discover history sheets from Google Sheets API
  const historySheets = await discoverHistorySheets();
  state.historySheets = historySheets;
  renderHistoryNav(fetchData, fetchHistoryData);

  fetchData(true);
}
