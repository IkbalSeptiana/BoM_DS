'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();

  function switchTo(locale: Locale) {
    // Replace the locale segment in the current path
    const segments = pathname.split('/');
    segments[1] = locale;
    return segments.join('/') || '/';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      {LOCALES.map(locale => (
        <Link
          key={locale}
          href={switchTo(locale)}
          className={`lang-btn${locale === current ? ' active' : ''}`}
        >
          {LOCALE_LABELS[locale]}
        </Link>
      ))}
    </div>
  );
}
