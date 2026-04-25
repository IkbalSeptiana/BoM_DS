import { getTranslations, isValidLocale, type Locale } from '@/lib/i18n';
import { HISTORY_SHEETS } from '@/lib/sheets.config';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default async function HistoryPage({ params }: { params: { locale: string } }) {
  if (!isValidLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const t = await getTranslations(locale);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* Top bar */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 100, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LanguageSwitcher current={locale} />
        <Link
          href={`/${locale}`}
          style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', letterSpacing: '.1em',
            padding: '5px 10px', borderRadius: 3, border: '1px solid rgba(56,189,248,.4)',
            background: 'rgba(56,189,248,.08)', color: 'var(--cyan)', textDecoration: 'none',
            textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          ← {t.mainEvent}
        </Link>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 14px 24px', flex: 1, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 className="site-title">{t.historyTitle}</h1>
          <p className="subtitle" style={{ marginTop: 6 }}>BOM District Showdown</p>
        </div>

        {HISTORY_SHEETS.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", fontSize: '.9rem', letterSpacing: '.1em' }}>
            {t.historyEmpty}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {HISTORY_SHEETS.map(sheet => {
              // Parse label from sheet name e.g. "BoM_04-2026" → "April 2026"
              const label = formatSheetLabel(sheet);
              return (
                <Link key={sheet} href={`/${locale}/history/${encodeURIComponent(sheet)}`} className="hist-card">
                  <div className="corner c-tl"/><div className="corner c-tr"/>
                  <div className="corner c-bl"/><div className="corner c-br"/>
                  <div style={{ fontFamily: "'Orbitron',monospace", fontSize: '.8rem', color: 'var(--cyan)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {sheet}
                  </div>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: '1rem', color: 'var(--text)', fontWeight: 600 }}>
                    {label}
                  </div>
                  <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: '.68rem', color: 'var(--cyan)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    {t.viewEvent} →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <footer style={{ borderTop: '1px solid rgba(56,189,248,.06)', padding: 16, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.62rem', color: 'var(--muted)', letterSpacing: '.1em' }}>
          {t.footer}
        </p>
      </footer>
    </main>
  );
}

function formatSheetLabel(name: string): string {
  // Match BoM_MM-YYYY or DS_MM-YYYY
  const m = name.match(/(\d{2})-(\d{4})$/);
  if (!m) return name;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const month = months[parseInt(m[1], 10) - 1] ?? m[1];
  return `${month} ${m[2]}`;
}
