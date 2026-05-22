import { t } from '../i18n/index.js';
import { state, CIRC, AUTO_S } from './state.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function badgeHtml(r) {
  if (!state.isLiverActive) return `<span style="color:var(--muted);font-size:.72rem">—</span>`;
  if (r._status === 'committed') return `<span class="badge b-committed">${t('badgeCommitted')}</span>`;
  if (r._status === 'failed') return `<span class="badge b-failed">${t('badgeFailed')}</span>`;
  return `<span class="badge b-pending">${t('badgeWaiting')}</span>`;
}

export function renderTable() {
  const tb = document.getElementById('tbody');
  tb.innerHTML = '';
  const thStatus = document.getElementById('th-status');
  thStatus.style.display = state.isLiverActive ? 'table-cell' : 'none';

  const countEl = document.getElementById('result-count');
  if (state.displayed.length !== state.allPlayers.length) {
    countEl.textContent = t('showingOf', state.displayed.length, state.allPlayers.length);
  } else {
    countEl.textContent = t('playersCount', state.allPlayers.length);
  }

  if (!state.displayed.length) {
    const cols = state.isLiverActive ? 7 : 6;
    tb.innerHTML = `<tr class="nodata"><td colspan="${cols}">${t('noData')}</td></tr>`;
    return;
  }

  state.displayed.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.className = 'ri';
    tr.style.animationDelay = Math.min(i * 15, 360) + 'ms';

    const packStr = (r._displayPack === '-' || r._displayPack === '0' || r._displayPack === '')
      ? `<span style="color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:.65rem">${r._displayPack === '-' ? '-' : '—'}</span>`
      : `<span class="pack-pill">${esc(r._displayPack)}</span>`;

    let noteParts = [];
    if (r._sponsoredBy) {
      noteParts.push(`${t('sponsoredBy')} <span style="color:var(--cyan);font-weight:600">${esc(r._sponsoredBy)}</span>`);
    }
    if (r._sponsoringTargets && r._sponsoringTargets.length > 0) {
      noteParts.push(`${t('sponsoring')} <span style="color:#c084fc;font-weight:600">${esc(r._sponsoringTargets.join(', '))}</span>`);
    }

    const packVal = Number(r._displayPack);
    if (state.isLiverActive && !isNaN(packVal) && packVal > r._commitment) {
      const extra = packVal - r._commitment;
      const word = extra === 1 ? t('pack') : t('packs_word');
      noteParts.push(`<span style="color:var(--green);font-size:.72rem">${t('thankYouExtra', extra, word)}</span>`);
    }

    const noteHtml = noteParts.length > 0
      ? `<span class="comment-note" style="font-style:normal">${noteParts.join('<br>')}</span>`
      : `<span style="color:var(--muted);font-size:.72rem">—</span>`;

    const statusTd = state.isLiverActive
      ? `<td style="text-align:center; padding-top:6px; padding-bottom:6px">${badgeHtml(r)}</td>`
      : '';

    tr.innerHTML = `
      <td class="row-num">${String(i + 1).padStart(2, '0')}</td>
      <td class="player-name">${esc(r.Player || '—')}</td>
      <td class="player-id hide-sm">${esc(r['Player ID'] || '—')}</td>
      <td>${r.Alliance ? `<span class="alliance-tag">${esc(r.Alliance.trim())}</span>` : `<span style="color:var(--muted)">—</span>`}</td>
      <td style="text-align:center">${packStr}</td>
      ${statusTd}
      <td>${noteHtml}</td>
    `;
    tb.appendChild(tr);
  });
}

export function renderBanTable(banMap) {
  const banTbody = document.getElementById('ban-tbody');
  banTbody.innerHTML = '';
  let banIndex = 1;

  if (banMap.size === 0) {
    banTbody.innerHTML = `<tr class="nodata"><td colspan="5">${t('noBanData')}</td></tr>`;
  } else {
    banMap.forEach(data => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-num">${String(banIndex++).padStart(2, '0')}</td>
        <td class="player-name">${esc(data.player)}</td>
        <td class="player-id">${esc(data.id)}</td>
        <td><span class="alliance-tag">${esc(data.alliance)}</span></td>
        <td class="comment-note">${esc(data.comment)}</td>
      `;
      banTbody.appendChild(tr);
    });
  }
}

export function updateStats() {
  const count = s => state.allPlayers.filter(r => r._status === s).length;
  document.getElementById('s-total').textContent = state.allPlayers.length;
  document.getElementById('s-banned').textContent = state.bannedCount;

  if (!state.isLiverActive) {
    document.getElementById('s-committed').textContent = '—';
    document.getElementById('s-pack').textContent = '—';
    document.getElementById('s-sponsored').textContent = '—';
    document.getElementById('s-failed').textContent = '—';
    document.getElementById('s-waiting').textContent = '—';
  } else {
    document.getElementById('s-committed').textContent = count('committed');
    document.getElementById('s-sponsored').textContent = state.allPlayers.filter(r => r._sponsoredBy).length;
    document.getElementById('s-failed').textContent = count('failed');
    document.getElementById('s-waiting').textContent = count('waiting');
    const totalPacks = state.allPlayers.reduce((sum, r) => {
      const v = Number(r._displayPack);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
    document.getElementById('s-pack').textContent = totalPacks;
  }
}

export function populateAlliances() {
  const sel = document.getElementById('allianceFilter');
  const cur = sel.value;
  const list = [...new Set(state.allPlayers.map(r => (r.Alliance || '').trim()).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">${t('allAlliances')}</option>`;
  list.forEach(a => {
    const o = document.createElement('option');
    o.value = a; o.textContent = a;
    sel.appendChild(o);
  });
  sel.value = cur || '';
}

export function startCountdown(fetchFn) {
  clearInterval(state.cdTimer);
  state.cdLeft = AUTO_S;
  tickCD();
  state.cdTimer = setInterval(() => {
    state.cdLeft--;
    tickCD();
    if (state.cdLeft <= 0) fetchFn(false);
  }, 1000);
}

function tickCD() {
  document.getElementById('cring-fill').style.strokeDashoffset = CIRC * (1 - state.cdLeft / AUTO_S);
  document.getElementById('cdown-txt').textContent = state.cdLeft + 's';
}

export function renderHistoryNav(onCurrent, onHistory) {
  const nav = document.getElementById('history-nav');
  if (!nav) return;
  nav.innerHTML = '';

  // Current event button
  const curBtn = document.createElement('button');
  curBtn.className = `ftab ${!state.viewingHistory ? 'on' : ''}`;
  curBtn.textContent = t('currentEvent');
  curBtn.onclick = () => {
    state.viewingHistory = null;
    document.getElementById('history-title').style.display = 'none';
    renderHistoryNav(onCurrent, onHistory);
    onCurrent(true);
  };
  nav.appendChild(curBtn);

  // History buttons
  state.historySheets.forEach(sheet => {
    const btn = document.createElement('button');
    btn.className = `ftab ${state.viewingHistory === sheet.sheet_name ? 'on' : ''}`;
    btn.textContent = sheet.display_name || sheet.event_date || sheet.sheet_name;
    btn.onclick = () => {
      state.viewingHistory = sheet.sheet_name;
      document.getElementById('history-title').style.display = 'block';
      document.getElementById('history-title').textContent = sheet.display_name || sheet.event_date;
      renderHistoryNav(onCurrent, onHistory);
      onHistory(sheet.sheet_name);
    };
    nav.appendChild(btn);
  });
}
