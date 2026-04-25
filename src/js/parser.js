import Papa from 'papaparse';

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

export function processBanData(banRows) {
  const banMap = new Map();
  let countWithoutId = 0;

  banRows.forEach(r => {
    const pid = getCol(r, 'Player ID');
    const pName = getCol(r, 'Player');
    let commentRaw = r['Comment (If the ID is red = duplicate)'] || getCol(r, 'Comment') || '-';
    const allianceRaw = getCol(r, 'Alliance') || '-';

    if (pid !== '') {
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

  return { banMap, bannedCount: banMap.size + countWithoutId };
}

export function processMainData(mainRows) {
  let isLiverActive = false;
  const sponsoringMap = {};
  const sponsoredByMap = {};

  // Pass 1: detect liver active & map sponsorships
  mainRows.forEach(r => {
    const n = getCol(r, 'Player');
    if (!n || n === 'Player' || n === 'KEEP FREE' || n.toLowerCase().includes('total player')) return;

    const liverData = getCol(r, 'Liver');
    if (liverData !== '') isLiverActive = true;

    const comment = getCol(r, 'Comments').trim();
    if (comment.toLowerCase().includes('cover')) {
      const sponsorName = comment.replace(/cover/ig, '').trim();
      if (sponsorName) {
        const spLower = sponsorName.toLowerCase();
        if (!sponsoringMap[spLower]) sponsoringMap[spLower] = [];
        sponsoringMap[spLower].push(n);
        sponsoredByMap[n.toLowerCase()] = sponsorName;
      }
    }
  });

  // Pass 2: build player objects
  const players = mainRows
    .filter(r => {
      const n = getCol(r, 'Player');
      return n && n !== 'Player' && n !== 'KEEP FREE' && !n.toLowerCase().includes('total player');
    })
    .map(r => {
      const n = getCol(r, 'Player');
      const nLower = n.toLowerCase();

      const verifiers = [getCol(r, 'Nox'), getCol(r, 'Akita'), getCol(r, 'Sarci'), getCol(r, 'Amanda')].map(v => v.toLowerCase());
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

  return { players, isLiverActive };
}
