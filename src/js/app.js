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
    // Cari pembungkus video
    const ytWrapper = document.getElementById('yt-wrapper');
    if (ytWrapper) {
      // Hapus video lama dan masukkan ulang HTML lite-youtube yang baru
      ytWrapper.innerHTML = `
        <lite-youtube 
            videoid="rd7mBaGaIc4" 
            params="start=57&rel=0&modestbranding=1"
            playlabel="Play Video">
        </lite-youtube>
      `;
    }
  }
}

let searchTimeout;
function handleSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    applyFilters();
  }, 500); // Tunggu 300ms setelah ketikan terakhir
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

/* ── Report Modal ── */
function openReportModal() {
  const modal = document.getElementById('reportModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Reset form
  document.getElementById('reportForm').reset();
  document.getElementById('reportForm').style.display = '';
  document.getElementById('reportSuccess').style.display = 'none';
  document.getElementById('reportError').style.display = 'none';
  document.getElementById('reasonCount').textContent = '0';
  updateReportLabels();
}

function closeReportModal() {
  const modal = document.getElementById('reportModal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function closeReportOutside(e) {
  if (e.target === document.getElementById('reportModal')) closeReportModal();
}

function updateReportLabels() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key.startsWith('label') || key.startsWith('hint') || key === 'reportTitle' || key === 'reportSubtitle' ||
        key === 'reporterInfo' || key === 'suspectInfo' || key === 'reasonInfo' ||
        key === 'cancel' || key === 'submitReport' || key === 'close' ||
        key === 'reportSuccessTitle' || key === 'reportSuccessText' || key === 'characters' || key === 'reportNote') {
      const val = t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = val;
      } else {
        el.textContent = val;
      }
    }
  });
}

function showReportError(msg) {
  const el = document.getElementById('reportError');
  document.getElementById('reportErrorText').textContent = msg;
  el.style.display = 'flex';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideReportError() {
  document.getElementById('reportError').style.display = 'none';
}

function checkDuplicateBanId(suspectId) {
  return state.bannedIds.has(suspectId);
}

function addBannedId(suspectId, suspectName, reporterAlliance, reason) {
  state.bannedIds.add(suspectId);
  state.bannedCount++;

  const banTbody = document.getElementById('ban-tbody');
  const newRow = document.createElement('tr');
  const newIndex = banTbody.querySelectorAll('tr:not(.nodata)').length + 1;
  newRow.innerHTML = `
    <td class="row-num">${String(newIndex).padStart(2, '0')}</td>
    <td class="player-name">${suspectName}</td>
    <td class="player-id">${suspectId}</td>
    <td><span class="alliance-tag">${reporterAlliance}</span></td>
    <td class="comment-note">${reason}</td>
  `;

  const nodataRow = banTbody.querySelector('.nodata');
  if (nodataRow) {
    nodataRow.remove();
  }
  banTbody.appendChild(newRow);

  document.getElementById('s-banned').textContent = state.bannedCount;
}

async function submitReport(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  const formData = {
    reporterId: document.getElementById('reporterId').value.trim(),
    reporterName: document.getElementById('reporterName').value.trim(),
    reporterAlliance: document.getElementById('reporterAlliance').value.trim(),
    suspectId: document.getElementById('suspectId').value.trim(),
    suspectName: document.getElementById('suspectName').value.trim(),
    reason: document.getElementById('reportReason').value.trim()
  };

  hideReportError();

  try {
    if (checkDuplicateBanId(formData.suspectId)) {
      showReportError(t('duplicateIdError'));
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      return;
    }

    const response = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Optimistically add the ID immediately so duplicate check works right away
      state.bannedIds.add(formData.suspectId);
      state.bannedCount++;
      document.getElementById('s-banned').textContent = state.bannedCount;
      document.getElementById('reportForm').style.display = 'none';
      document.getElementById('reportSuccess').style.display = '';
      // Refetch ban list in background to fully sync
      fetchBanData();
    } else {
      showReportError(result.message || result.details || t('reportError'));
    }
  } catch (err) {
    showReportError('Network error: ' + err.message);
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}

async function fetchBanData() {
  try {
    const banSheet = state.banSheet ? state.banSheet.sheet_name : 'BanList';
    const banCSV = await fetchSheetCSV(banSheet);
    const banRes = await parseCSV(banCSV);
    const { banMap, bannedIds, bannedCount } = processBanData(banRes.data);
    state.bannedCount = bannedCount;
    state.bannedIds = bannedIds;
    renderBanTable(banMap);
    updateStats();
  } catch (err) {
    console.error('Failed to refetch ban list:', err);
  }
}

function setupCharCounter() {
  const textarea = document.getElementById('reportReason');
  const counter = document.getElementById('reasonCount');
  if (textarea && counter) {
    textarea.addEventListener('input', () => {
      counter.textContent = textarea.value.length;
    });
  }
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
    const raw_a = a[col] ?? '';
    const raw_b = b[col] ?? '';
    const numA = Number(raw_a);
    const numB = Number(raw_b);
    const isNum = !isNaN(numA) && !isNaN(numB) && raw_a !== '' && raw_b !== '';
    if (isNum) return asc ? numA - numB : numB - numA;
    const va = String(raw_a).toLowerCase();
    const vb = String(raw_b).toLowerCase();
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}


// Fungsi baru untuk memformat ulang tanggal setiap kali dibutuhkan
function updateLastSyncUI() {
  const el = document.getElementById('last-sync');
  if (!el) return;

  if (!state.lastSyncISO) {
    el.textContent = t('lastSync') + ' —';
    return;
  }

  const activeLang = getLang();
  const dateOpts = { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: false, 
    calendar: 'gregory' 
  };
  
  const dateObj = new Date(state.lastSyncISO);
  const timeString = dateObj.toLocaleString(activeLang, dateOpts);

  el.textContent = t('lastSync') + ' ' + timeString;
}

/* ── Data Fetching ── */
async function fetchData(spinner = false) {
  const syncContainer = document.getElementById('sync-container');
  if (syncContainer) syncContainer.style.display = 'flex';

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

    const { banMap, bannedIds, bannedCount } = processBanData(banRes.data);
    state.bannedCount = bannedCount;
    state.bannedIds = bannedIds;
    renderBanTable(banMap);

    const { players, isLiverActive, lastModifiedISO } = processMainData(mainRes.data);
    state.allPlayers = players;
    state.isLiverActive = isLiverActive;

    document.getElementById('col-pack-title').textContent = isLiverActive ? t('colPacks') : t('colCommitment');

    populateAlliances();
    applyFilters();
    updateStats();

    // --- LOGIKA WAKTU TERBARU UNTUK LIVE ---
    state.lastSyncISO = lastModifiedISO || new Date().toISOString();
    updateLastSyncUI();
    const activeLang = getLang(); // Ambil bahasa yang sedang dipilih di web
    const dateOpts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, calendar: 'gregory' };
    
    let timeString = '';
    if (lastModifiedISO) {
      const dateObj = new Date(lastModifiedISO);
      timeString = dateObj.toLocaleString(activeLang, dateOpts);
    } else {
      timeString = '— (No Date Data)';
    }

    state.lastSyncTime = timeString; 
    document.getElementById('last-sync').textContent = t('lastSync') + ' ' + timeString;
    // --- AKHIR KODE BARU LAST MODIFIED ---

    document.getElementById('rf-icon').classList.remove('spin');
    startCountdown(fetchData);
  } catch (err) {
    document.getElementById('rf-icon').classList.remove('spin');
    document.getElementById('tbody').innerHTML = `<tr class="nodata"><td colspan="7" style="color:var(--red)">${t('fetchFailed')}</td></tr>`;
  }
}

async function fetchHistoryData(sheetName) {
  // Stop the live countdown while viewing history
  clearInterval(state.cdTimer);
  document.getElementById('cdown-txt').textContent = '—';
  document.getElementById('cring-fill').style.strokeDashoffset = 0;
  
  // TAMBAHKAN BARIS INI: Sembunyikan tombol refresh & timer
  document.getElementById('sync-container').style.display = 'none';

  document.getElementById('rf-icon').classList.add('spin');
  document.getElementById('tbody').innerHTML = `<tr class="nodata"><td colspan="7">${t('fetching')}</td></tr>`;

  try {
    const csv = await fetchSheetCSV(sheetName);
    const res = await parseCSV(csv);
    const { players, isLiverActive, lastModifiedISO } = processMainData(res.data);

    state.allPlayers = players;
    state.isLiverActive = isLiverActive;
    state.activeFilter = 'all';
    document.querySelectorAll('.ftab[data-filter]').forEach(b => b.classList.remove('on'));
    document.querySelector('.ftab[data-filter="all"]').classList.add('on');

    document.getElementById('col-pack-title').textContent = isLiverActive ? t('colPacks') : t('colCommitment');

    populateAlliances();
    applyFilters();
    updateStats();

    // --- LOGIKA WAKTU UNTUK HISTORI ---
    state.lastSyncISO = lastModifiedISO;
    updateLastSyncUI();
    const activeLang = getLang(); // Ambil bahasa yang sedang dipilih di web
    const dateOpts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, calendar: 'gregory' };
    
    let timeString = '';
    if (lastModifiedISO) {
      const dateObj = new Date(lastModifiedISO);
      timeString = dateObj.toLocaleString(activeLang, dateOpts);
    } else {
      timeString = '— (No Date Data)';
    }

    state.lastSyncTime = timeString; 
    document.getElementById('last-sync').textContent = t('lastSync') + ' ' + timeString;

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
      updateLastSyncUI();
      document.getElementById('langModal').classList.remove('open');
      document.body.style.overflow = '';
    };
    container.appendChild(btn);
  });
}

/* ── API Modal ── */
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
  window.handleSearchInput = handleSearchInput;
  window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  window.openReportModal = openReportModal;
  window.closeReportModal = closeReportModal;
  window.closeReportOutside = closeReportOutside;
  window.submitReport = submitReport;

  // Apply language
  applyAll();
  buildLangSwitcher();
  setupBackToTop();
  setupCharCounter();

  // Load sheet config
  state.currentSheet = SHEET_CONFIG.current;
  state.banSheet = SHEET_CONFIG.ban;

  // Auto-discover history sheets from Google Sheets API
  const historySheets = await discoverHistorySheets();
  state.historySheets = historySheets;
  renderHistoryNav(fetchData, fetchHistoryData);

  fetchData(true);
}
