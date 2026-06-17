import Papa from 'papaparse';
import { VERIFIER_COLS } from './api.js';

export function parseCSV(csvText) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      complete: resolve,
      error: reject
    });
  });
}

export function getCol(row, key) {
  const k = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
  return k ? (row[k] || '').toString().trim() : '';
}

function normalizePid(raw) {
  const s = raw.replace(/^'+/, '').trim();
  if (/^\d{1,10}$/.test(s)) return s.padStart(10, '0');
  return s;
}

export function processBanData(banRows) {
  const banMap = new Map();
  const bannedIds = new Set();
  let countWithoutId = 0;

  banRows.forEach(r => {
    const pid = normalizePid(getCol(r, 'Player ID'));
    const pName = getCol(r, 'Player');
    let commentRaw = r['Comment (If the ID is red = duplicate)'] || getCol(r, 'Comment') || '-';
    const allianceRaw = getCol(r, 'Alliance') || '-';

    if (pid !== '') {
      bannedIds.add(pid);
      if (banMap.has(pid)) {
        const existing = banMap.get(pid);
        if (pName && !existing.player.split(' / ').includes(pName)) {
          existing.player += ' / ' + pName;
        }
        if (allianceRaw !== '-' && !existing.alliance.split(' / ').includes(allianceRaw)) {
          existing.alliance = existing.alliance === '-' ? allianceRaw : existing.alliance + ' / ' + allianceRaw;
        }
        if (commentRaw !== '-' && !existing.comment.split(' / ').includes(commentRaw)) {
          existing.comment = existing.comment === '-' ? commentRaw : existing.comment + ' / ' + commentRaw;
        }
      } else {
        banMap.set(pid, { id: pid, player: pName || '-', alliance: allianceRaw, comment: commentRaw });
      }
    } else if (pName !== '') {
      countWithoutId++;
    }
  });

  return { banMap, bannedIds, bannedCount: banMap.size + countWithoutId };
}

export function processMainData(mainRows) {
  let isLiverActive = false;
  const sponsoringMap = {};
  const sponsoredByMap = {};
  
  // Variabel untuk menyimpan waktu dari CSV
  let lastModifiedISO = null;
  // Regex untuk mencari format ISO (mengabaikan spasi atau tanda petik tunggal bawaan Sheets)
  const isoRegex = /^\s*'?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s*$/;

  // 1. Ekstrak timestamp dari SELURUH baris (termasuk baris 183 ke bawah)
  for (let i = 0; i < mainRows.length; i++) {
    if (lastModifiedISO) break; // Hentikan pencarian jika timestamp sudah ditemukan
    for (const key in mainRows[i]) {
      const val = String(mainRows[i][key] || '');
      const match = val.match(isoRegex);
      if (match) {
        lastModifiedISO = match[1];
        break;
      }
    }
  }

  // 2. Batasi data pemain HANYA sampai baris 180 di Google Sheets.
  // Sheet Baris 1 = Header (dihapus oleh PapaParse)
  // Sheet Baris 2 = mainRows[0]
  // Sheet Baris 180 = mainRows[178]
  // slice(0, 179) akan mengambil index 0 hingga 178.
  const playerRows = mainRows.slice(0, 179);

  // Pass 1: detect liver active & map sponsorships HANYA dari playerRows
  playerRows.forEach(r => {
    const n = getCol(r, 'Player');
    // Pengecekan nama tetap dipertahankan untuk mengabaikan sel kosong atau header nyasar
    if (!n || n === 'Player' || n === 'KEEP FREE' || n.toLowerCase().includes('total player')) return;

    const liverData = getCol(r, 'Liver');
    if (liverData !== '') isLiverActive = true;

    const comment = getCol(r, 'Comments').trim();
    if (/(cover|sponsor)/i.test(comment)) {
      const sponsorName = comment.replace(/(cover|sponsor)/ig, '').trim();
      if (sponsorName) {
        const spLower = sponsorName.toLowerCase();
        if (!sponsoringMap[spLower]) sponsoringMap[spLower] = [];
        sponsoringMap[spLower].push(n);
        sponsoredByMap[n.toLowerCase()] = sponsorName;
      }
    }
  });

  // Pass 2: build player objects HANYA dari playerRows
  const players = playerRows
    .filter(r => {
      const n = getCol(r, 'Player');
      
      const isValidName = n && n !== 'Player' && n !== 'KEEP FREE' && !n.toLowerCase().includes('total player');
      if (!isValidName) return false;

      if (isLiverActive) {
        const joinedVal = getCol(r, 'Joined \n(x)').toLowerCase();
        if (joinedVal !== 'x') {
          return false; 
        }
      }

      return true;
    })
    .map(r => {
      const n = getCol(r, 'Player');
      const nLower = n.toLowerCase();

      const verifiers = VERIFIER_COLS.map(v => getCol(r, v).toLowerCase());
      let isConfirmed = verifiers.includes('confirmed');
      let isFailed = verifiers.includes('failed');

      let status = 'waiting';
      if (isFailed) status = 'failed';
      else if (isConfirmed) status = 'committed';

      const liverData = getCol(r, 'Liver');
      let displayVal = '';
      if (isLiverActive) {
        displayVal = (liverData !== '') ? (isNaN(Number(liverData)) ? '-' : liverData) : '-';
      } else {
        displayVal = getCol(r, 'Commitment') || '0';
      }

      const sponsoringTargets = sponsoringMap[nLower] || [];
      const sponsoredBy = sponsoredByMap[nLower] || null;

      return {
        Player: n,
        'Player ID': getCol(r, 'Player ID'),
        Alliance: getCol(r, 'Alliance'),
        _displayPack: displayVal,
        _commitment: Number(getCol(r, 'Commitment')) || 0,
        _status: status,
        _sponsoringTargets: sponsoringTargets,
        _sponsoredBy: sponsoredBy
      };
    });

  return { players, isLiverActive, lastModifiedISO };
}
