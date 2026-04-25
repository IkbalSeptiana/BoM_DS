import { LOCALES, isValidLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return LOCALES.map(locale => ({ locale }));
}

export default function LocaleLayout({ children, params }) {
  if (!isValidLocale(params.locale)) notFound();

  return (
    <>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body>{children}</body>
    </>
  );
}