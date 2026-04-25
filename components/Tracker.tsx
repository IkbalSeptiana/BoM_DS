'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ── Types ── */
type Status = 'committed' | 'failed' | 'waiting';
type FilterKey = 'all' | 'committed' | 'sponsored' | 'sponsoring' | 'failed' | 'waiting';

interface Player {
  Player: string;
  'Player ID': string;
  Alliance: string;
  _displayPack: string;
  _commitment: number;
  _status: Status;
  _sponsoringTargets: string[];
  _sponsoredBy: string | null;
}

interface SortState { col: string | null; asc: boolean; }

type T = Record<string, string>;

/* ── CSV parser (no dependency) ── */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCSVRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSVRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.replace(/^"|"$/g, '')] = (vals[i] ?? '').replace(/^"|"$/g, ''); });
    return obj;
  });
}

function splitCSVRow(row: string): string[] {
  const result: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

const getCol = (row: Record<string, string>, key: string): string => {
  const k = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
  return k ? (row[k] || '').toString().trim() : '';
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Props ── */
interface TrackerProps {
  t: T;
  locale: string;
  mainSheet: string;
  banSheet: string;
  /** If provided, fetches this sheet instead of mainSheet and hides auto-refresh (history mode) */
  historySheet?: string;
}

const AUTO_S = 120;
const CIRC   = 62.83;

export default function Tracker({ t, locale, mainSheet, banSheet, historySheet }: TrackerProps) {
  const isHistory = !!historySheet;

  const [allPlayers, setAllPlayers]     = useState<Player[]>([]);
  const [displayed,  setDisplayed]      = useState<Player[]>([]);
  const [bannedCount, setBannedCount]   = useState(0);
  const [isLiverActive, setLiverActive] = useState(false);
  const [sortState,  setSortState]      = useState<SortState>({ col: null, asc: true });
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [search,     setSearch]         = useState('');
  const [alliance,   setAlliance]       = useState('');
  const [alliances,  setAlliances]      = useState<string[]>([]);
  const [lastSync,   setLastSync]       = useState('');
  const [loading,    setLoading]        = useState(true);
  const [error,      setError]          = useState(false);
  const [rulesOpen,  setRulesOpen]      = useState(false);
  const [cdLeft,     setCdLeft]         = useState(AUTO_S);
  const [spinning,   setSpinning]       = useState(false);
  const [showBtt,    setShowBtt]        = useState(false);

  const cdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /* ── Fetch ── */
  const fetchData = useCallback(async (spinner = false) => {
    if (spinner) setSpinning(true);
    setLoading(true);
    setError(false);

    try {
      const sheetName = historySheet || mainSheet;
      const [mainRes, banRes] = await Promise.all([
        fetch(`/api/sheet?name=${encodeURIComponent(sheetName)}`),
        fetch(`/api/sheet?name=${encodeURIComponent(banSheet)}`),
      ]);
      const mainText = await mainRes.text();
      const banText  = await banRes.text();

      const mainData = parseCSV(mainText);
      const banData  = parseCSV(banText);

      // Count banned
      const uniqueBans = new Set<string>();
      let countNoId = 0;
      banData.forEach(r => {
        const pid = getCol(r, 'Player ID');
        const pn  = getCol(r, 'Player');
        if (pid) uniqueBans.add(pid);
        else if (pn) countNoId++;
      });
      setBannedCount(uniqueBans.size + countNoId);

      // Check liver active
      let liverActive = false;
      const sponsoringMap: Record<string, string[]> = {};
      const sponsoredByMap: Record<string, string>  = {};

      mainData.forEach(r => {
        const n = getCol(r, 'Player');
        if (!n || n === 'Player' || n === 'KEEP FREE' || n.toLowerCase().includes('total player')) return;
        if (getCol(r, 'Liver') !== '') liverActive = true;

        const comment = getCol(r, 'Comments').trim();
        if (comment.toLowerCase().includes('cover')) {
          const sponsorName = comment.replace(/cover/ig, '').trim();
          if (sponsorName) {
            const spL = sponsorName.toLowerCase();
            if (!sponsoringMap[spL]) sponsoringMap[spL] = [];
            sponsoringMap[spL].push(n);
            sponsoredByMap[n.toLowerCase()] = sponsorName;
          }
        }
      });

      setLiverActive(liverActive);

      const players: Player[] = mainData
        .filter(r => {
          const n = getCol(r, 'Player');
          return n && n !== 'Player' && n !== 'KEEP FREE' && !n.toLowerCase().includes('total player');
        })
        .map(r => {
          const n     = getCol(r, 'Player');
          const nLow  = n.toLowerCase();
          const verifiers = [
            getCol(r, 'Nox'), getCol(r, 'Akita'), getCol(r, 'Sarci'), getCol(r, 'Amanda')
          ].map(v => v.toLowerCase());

          let status: Status = 'waiting';
          if (verifiers.includes('failed'))    status = 'failed';
          else if (verifiers.includes('confirmed')) status = 'committed';

          const liverData = getCol(r, 'Liver');
          let displayVal = '';
          if (liverActive) {
            displayVal = liverData !== '' ? (isNaN(Number(liverData)) ? '-' : liverData) : '-';
          } else {
            displayVal = getCol(r, 'Commitment') || '0';
          }

          return {
            Player: n,
            'Player ID': getCol(r, 'Player ID'),
            Alliance: getCol(r, 'Alliance'),
            _displayPack: displayVal,
            _commitment: Number(getCol(r, 'Commitment')) || 0,
            _status: status,
            _sponsoringTargets: sponsoringMap[nLow] || [],
            _sponsoredBy: sponsoredByMap[nLow] || null,
          };
        });

      setAllPlayers(players);
      const unis = [...new Set(players.map(r => r.Alliance.trim()).filter(Boolean))].sort();
      setAlliances(unis);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, [mainSheet, banSheet, historySheet]);

  /* ── Auto-refresh countdown ── */
  const startCountdown = useCallback(() => {
    if (isHistory) return;
    if (cdTimer.current) clearInterval(cdTimer.current);
    setCdLeft(AUTO_S);
    cdTimer.current = setInterval(() => {
      setCdLeft(prev => {
        if (prev <= 1) { fetchData(false); return AUTO_S; }
        return prev - 1;
      });
    }, 1000);
  }, [fetchData, isHistory]);

  useEffect(() => {
    fetchData(true).then(() => startCountdown());
    return () => { if (cdTimer.current) clearInterval(cdTimer.current); };
  }, [fetchData, startCountdown]);

  /* ── Scroll for back-to-top ── */
  useEffect(() => {
    const onScroll = () => setShowBtt(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Apply filters ── */
  useEffect(() => {
    let result = allPlayers.filter(r => {
      const blob = (r.Player + ' ' + r['Player ID'] + ' ' + r.Alliance).toLowerCase();
      const qOk  = !search  || blob.includes(search.toLowerCase());
      const aOk  = !alliance || r.Alliance.trim().toLowerCase() === alliance.toLowerCase();
      let sOk = false;
      if (activeFilter === 'all')        sOk = true;
      else if (activeFilter === 'sponsored')  sOk = r._sponsoredBy !== null;
      else if (activeFilter === 'sponsoring') sOk = r._sponsoringTargets.length > 0;
      else                               sOk = r._status === activeFilter;
      return qOk && aOk && sOk;
    });

    if (sortState.col) {
      result = [...result].sort((a, b) => {
        const va = ((a as unknown as Record<string, unknown>)[sortState.col!] || '').toString().toLowerCase();
        const vb = ((b as unknown as Record<string, unknown>)[sortState.col!] || '').toString().toLowerCase();
        if (va < vb) return sortState.asc ? -1 : 1;
        if (va > vb) return sortState.asc ?  1 : -1;
        return 0;
      });
    }
    setDisplayed(result);
  }, [allPlayers, search, alliance, activeFilter, sortState]);

  /* ── Sort ── */
  function handleSort(col: string) {
    setSortState(s => s.col === col ? { col, asc: !s.asc } : { col, asc: true });
  }

  function sortIcon(col: string) {
    if (sortState.col !== col) return <span className="si">⇕</span>;
    return <span className="si on">{sortState.asc ? '▲' : '▼'}</span>;
  }

  /* ── Stats ── */
  const count = (s: Status) => allPlayers.filter(r => r._status === s).length;
  const totalPacks = allPlayers.reduce((sum, r) => {
    const v = Number(r._displayPack); return sum + (isNaN(v) ? 0 : v);
  }, 0);

  /* ── Badge HTML ── */
  function badgeHtml(r: Player) {
    if (!isLiverActive) return <span style={{ color: 'var(--muted)', fontSize: '.72rem' }}>—</span>;
    if (r._status === 'committed') return <span className="badge b-committed">✓ {t.statusCommitted}</span>;
    if (r._status === 'failed')    return <span className="badge b-failed">❌ {t.statusFailed}</span>;
    return <span className="badge b-pending">⏳ {t.statusWaiting}</span>;
  }

  /* ── Note ── */
  function noteHtml(r: Player) {
    const parts: React.ReactNode[] = [];
    if (r._sponsoredBy) {
      parts.push(
        <span key="sb">{t.sponsoredBy} <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{r._sponsoredBy}</span></span>
      );
    }
    if (r._sponsoringTargets.length > 0) {
      parts.push(
        <span key="st">{t.sponsoring} <span style={{ color: '#c084fc', fontWeight: 600 }}>{r._sponsoringTargets.join(', ')}</span></span>
      );
    }
    const packVal = Number(r._displayPack);
    if (isLiverActive && !isNaN(packVal) && packVal > r._commitment) {
      const extra = packVal - r._commitment;
      const packWord = extra === 1 ? t.pack : t.packs;
      parts.push(
        <span key="ty" style={{ color: 'var(--green)', fontSize: '.72rem' }}>
          🙏 {t.thankYouExtra.replace('{n}', String(extra)).replace('{pack}', packWord)}
        </span>
      );
    }
    if (!parts.length) return <span style={{ color: 'var(--muted)', fontSize: '.72rem' }}>—</span>;
    return (
      <span className="comment-note" style={{ fontStyle: 'normal' }}>
        {parts.map((p, i) => <span key={i}>{i > 0 && <br />}{p}</span>)}
      </span>
    );
  }

  /* ── Pack display ── */
  function packStr(r: Player) {
    const v = r._displayPack;
    if (v === '-' || v === '0' || v === '')
      return <span style={{ color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", fontSize: '.65rem' }}>{v === '-' ? '-' : '—'}</span>;
    return <span className="pack-pill">{esc(v)}</span>;
  }

  /* ── Countdown ring ── */
  const offset = CIRC * (1 - cdLeft / AUTO_S);

  /* ── Render ── */
  return (
    <>
      {/* ── Top bar: Lang + Rules ── */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button className="rules-btn" onClick={() => setRulesOpen(true)}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          {t.eventRules}
        </button>
      </div>

      {/* ── Rules Modal ── */}
      <div className={`modal-overlay${rulesOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) closeRules(); }}>
        <div className="modal-box">
          <div className="corner c-tl"/><div className="corner c-tr"/>
          <div className="corner c-bl"/><div className="corner c-br"/>
          <div className="modal-scroll">
            <button className="modal-close" onClick={closeRules}>✕</button>
            <div className="modal-title">{t.rulesTitle}</div>

            <div className="rsec">
              <div className="rsec-title">{t.rulesBasicTitle}</div>
              <div className="ritem">{t.rulesDrama}</div>
              <div className="ritem"><strong style={{ color: 'var(--amber)' }}>Do not</strong> {t.rulesName}</div>
              <div className="ritem">{t.rulesOnline}</div>
            </div>

            <div className="rsec" style={{ background: 'rgba(168,85,247,.04)', border: '1px solid rgba(168,85,247,.12)', borderRadius: 3, padding: '12px 14px' }}>
              <div className="rsec-title">{t.rulesHowTitle}</div>
              <div className="ritem">{t.rulesHowText}</div>
              <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', marginTop: 10, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(168,85,247,.3)' }}>
                <iframe
                  ref={iframeRef}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  src="https://www.youtube.com/embed/rd7mBaGaIc4?si=wfzdMEI_vFyC42rF&start=57"
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>

            <div className="rsec">
              <div className="rsec-title">{t.rulesYourTitle}</div>
              <div className="ritem">{t.rulesYourPack}</div>
              <div className="ritem">All packs must be purchased before <strong style={{ color: 'var(--amber)' }}>Saturday 16:00 UTC</strong></div>
              <div className="ritem">{t.rulesYourLeave}</div>
              <div className="ritem">{t.rulesYourStay}</div>
              <div className="ritem">{t.rulesYourKey}</div>
            </div>

            <div className="rsec">
              <div className="rsec-title">{t.rulesOurTitle}</div>
              <div className="ritem"><strong style={{ color: 'var(--green)' }}>90% of gold donations refunded</strong> at event end — only if you complete your commitment</div>
              <div className="ritem">{t.rulesOurMerit}</div>
              <div className="ritem">{t.rulesOurGate}</div>
              <div className="ritem">{t.rulesOurRemind}</div>
            </div>

            <div className="rsec" style={{ background: 'rgba(56,189,248,.04)', border: '1px solid rgba(56,189,248,.12)', borderRadius: 3, padding: '12px 14px' }}>
              <div className="rsec-title">{t.rulesSponsorTitle}</div>
              <div className="ritem">{t.rulesSponsor1}</div>
              <div className="ritem">{t.rulesSponsor2}</div>
              <div className="ritem">{t.rulesSponsor3}</div>
              <div className="ritem">{t.rulesSponsor4}</div>
            </div>

            <p style={{ textAlign: 'center', fontFamily: "'Rajdhani',sans-serif", fontSize: '.78rem', color: 'var(--dim)', marginTop: 16 }}>
              {t.rulesContact} <span style={{ color: '#c084fc', fontWeight: 700 }}>Sarci</span> · <span style={{ color: '#c084fc', fontWeight: 700 }}>ᴮᵒᴹNØX</span> · <span style={{ color: '#c084fc', fontWeight: 700 }}>Amandaᥫ᭡ᵕ̈</span> · <span style={{ color: '#c084fc', fontWeight: 700 }}>MissCake᭡ᵕ̈</span>
            </p>
            <p style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: '.62rem', color: 'var(--muted)', marginTop: 8 }}>{t.rulesFooter}</p>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1140, margin: '0 auto', padding: '24px 14px', flex: 1, width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 22, paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 5 }}>
            <div className="live-dot" />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.62rem', letterSpacing: '.25em', color: 'var(--green)', textTransform: 'uppercase' }}>
              {isHistory ? historySheet : t.liveTracking}
            </span>
          </div>
          <h1 className="site-title">{t.title}</h1>
          <p className="subtitle" style={{ marginTop: 5 }}>{t.subtitle}</p>
        </div>

        {/* Stat cards */}
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'total',     cls: 'sc-total',   val: allPlayers.length,                                       lbl: t.statsTotal,     color: 'var(--cyan)' },
            { id: 'committed', cls: 'sc-commit',  val: isLiverActive ? count('committed') : '—',               lbl: t.statsCommitted, color: 'var(--green)' },
            { id: 'pack',      cls: 'sc-commit',  val: isLiverActive ? totalPacks : '—',                       lbl: t.statsPacks,     color: 'var(--green)' },
            { id: 'sponsored', cls: 'sc-sponsor', val: isLiverActive ? allPlayers.filter(r=>r._sponsoredBy).length : '—', lbl: t.statsSponsored, color: 'var(--cyan)' },
            { id: 'failed',    cls: 'sc-failed',  val: isLiverActive ? count('failed') : '—',                  lbl: t.statsFailed,    color: 'var(--red)' },
            { id: 'waiting',   cls: 'sc-pending', val: isLiverActive ? count('waiting') : '—',                 lbl: t.statsWaiting,   color: 'var(--amber)' },
            { id: 'banned',    cls: 'sc-banned',  val: bannedCount,                                             lbl: t.statsBanned,    color: 'var(--red)' },
          ].map(s => (
            <div key={s.id} className={`stat-card ${s.cls}`}>
              <div className="stat-num" style={{ color: s.color }}>{loading && s.id !== 'banned' ? '—' : s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-dim)', borderRadius: 4, padding: '12px 14px', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--dim)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input type="text" className="s-input" style={{ width: '100%' }} placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {/* Alliance filter */}
            <select className="s-select" value={alliance} onChange={e => setAlliance(e.target.value)}>
              <option value="">{t.allAlliances}</option>
              {alliances.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {/* Countdown + Refresh */}
            {!isHistory && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 'auto' }}>
                <svg className="cring" viewBox="0 0 26 26">
                  <circle cx="13" cy="13" r="10" stroke="rgba(56,189,248,.13)" strokeWidth="3" fill="none"/>
                  <circle cx="13" cy="13" r="10" stroke="var(--cyan)" strokeWidth="3" fill="none"
                    strokeDasharray={CIRC} strokeDashoffset={offset} strokeLinecap="round"/>
                </svg>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.68rem', color: 'var(--dim)' }}>{cdLeft}s</span>
                <button className="rfbtn" onClick={() => fetchData(true)}>
                  <svg id="rf-icon" style={{ width: 12, height: 12, animation: spinning ? 'spin .8s linear infinite' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  {t.refresh}
                </button>
              </div>
            )}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.58rem', color: 'var(--muted)', letterSpacing: '.15em', textTransform: 'uppercase', marginRight: 4 }}>{t.filter}:</span>
            {([
              ['all', `${t.filterAll}`],
              ['committed', `✓ ${t.filterCommitted}`],
              ['sponsored', `💠 ${t.filterSponsored}`],
              ['sponsoring', `⬆ ${t.filterSponsoring}`],
              ['failed', `❌ ${t.filterFailed}`],
              ['waiting', `⏳ ${t.filterWaiting}`],
            ] as [FilterKey, string][]).map(([key, label]) => (
              <button key={key} className={`ftab${activeFilter === key ? ' on' : ''}`} onClick={() => setActiveFilter(key)}>{label}</button>
            ))}
          </div>

          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', color: 'var(--muted)', letterSpacing: '.05em' }}>
            {lastSync ? `${t.lastSync}: ${lastSync}` : t.awaitingLoad}
          </div>
        </div>

        {/* Result count */}
        <div style={{ textAlign: 'right', marginBottom: 5, padding: '0 2px' }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.72rem', color: 'var(--muted)' }}>
            {displayed.length !== allPlayers.length
              ? t.showing.replace('{n}', String(displayed.length)).replace('{total}', String(allPlayers.length))
              : t.players.replace('{n}', String(allPlayers.length))}
          </span>
        </div>

        {/* Table */}
        <div className="hud" style={{ overflow: 'hidden', marginBottom: 28 }}>
          <div className="corner c-tl"/><div className="corner c-tr"/>
          <div className="corner c-bl"/><div className="corner c-br"/>
          <div style={{ overflowX: 'auto' }}>
            <table className="main-table">
              <thead>
                <tr>
                  <th style={{ width: 46 }}>#</th>
                  <th className="sortable" onClick={() => handleSort('Player')}>{t.colPlayer} {sortIcon('Player')}</th>
                  <th className="sortable hide-sm" onClick={() => handleSort('Player ID')}>{t.colId} {sortIcon('Player ID')}</th>
                  <th className="sortable" onClick={() => handleSort('Alliance')}>{t.colAlliance} {sortIcon('Alliance')}</th>
                  <th className="sortable" onClick={() => handleSort('_displayPack')} style={{ textAlign: 'center' }}>
                    {isLiverActive ? t.colPacks : t.colCommitment} {sortIcon('_displayPack')}
                  </th>
                  {isLiverActive && <th style={{ textAlign: 'center' }}>{t.colStatus}</th>}
                  <th>{t.colNote}</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr className="nodata"><td colSpan={isLiverActive ? 7 : 6} style={{ color: 'var(--red)' }}>{t.fetchError}</td></tr>
                ) : loading ? (
                  <tr className="nodata"><td colSpan={isLiverActive ? 7 : 6}>{t.fetchingData}</td></tr>
                ) : !displayed.length ? (
                  <tr className="nodata"><td colSpan={isLiverActive ? 7 : 6}>{t.noMatch}</td></tr>
                ) : displayed.map((r, i) => (
                  <tr key={r.Player + i} className="ri" style={{ animationDelay: `${Math.min(i * 15, 360)}ms` }}>
                    <td className="row-num">{String(i + 1).padStart(2, '0')}</td>
                    <td className="player-name">{esc(r.Player || '—')}</td>
                    <td className="player-id hide-sm">{esc(r['Player ID'] || '—')}</td>
                    <td>{r.Alliance
                      ? <span className="alliance-tag">{esc(r.Alliance.trim())}</span>
                      : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{packStr(r)}</td>
                    {isLiverActive && <td style={{ textAlign: 'center', paddingTop: 6, paddingBottom: 6 }}>{badgeHtml(r)}</td>}
                    <td>{noteHtml(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Back to top */}
      <button className={`btt-btn${showBtt ? ' show' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title={t.backToTop}>
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
        </svg>
      </button>
    </>
  );

  function closeRules() {
    setRulesOpen(false);
    if (iframeRef.current) {
      const src = iframeRef.current.src;
      iframeRef.current.src = '';
      iframeRef.current.src = src;
    }
  }
}
