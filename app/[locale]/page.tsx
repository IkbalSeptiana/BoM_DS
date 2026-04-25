import { getTranslations, isValidLocale, type Locale } from '@/lib/i18n';
import { MAIN_SHEET, BAN_SHEET } from '@/lib/sheets.config';
import { notFound } from 'next/navigation';
import Tracker from '@/components/Tracker';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Link from 'next/link';

export default async function Page({ params }: { params: { locale: string } }) {
  if (!isValidLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const t = await getTranslations(locale);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>

      {/* Top bar */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 100, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <LanguageSwitcher current={locale} />
        <Link
          href={`/${locale}/history`}
          style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: '.7rem', letterSpacing: '.1em',
            padding: '5px 10px', borderRadius: 3, border: '1px solid rgba(168,85,247,.4)',
            background: 'rgba(168,85,247,.08)', color: '#c084fc', textDecoration: 'none',
            textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}
        >
          📜 {t.history}
        </Link>
      </div>

      <Tracker t={t} locale={locale} mainSheet={MAIN_SHEET} banSheet={BAN_SHEET} />

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(56,189,248,.06)', padding: 16, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.62rem', color: 'var(--muted)', letterSpacing: '.1em' }}>
          {t.footer}
        </p>
      </footer>
    </main>
  );
}
