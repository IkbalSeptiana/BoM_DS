export const LOCALES = ['en', 'id', 'sp', 'rs'] as const;
export type Locale = typeof LOCALES[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  id: 'Indonesia',
  sp: 'Español',
  rs: 'Русский',
};

export function isValidLocale(l: string): l is Locale {
  return LOCALES.includes(l as Locale);
}

type Translations = Record<string, string>;

const cache: Partial<Record<Locale, Translations>> = {};

export async function getTranslations(locale: Locale): Promise<Translations> {
  if (cache[locale]) return cache[locale]!;
  try {
    // Dynamic import for server components
    const mod = await import(`../locales/${locale}.json`);
    cache[locale] = mod.default as Translations;
    return cache[locale]!;
  } catch {
    const fallback = await import('../locales/en.json');
    return fallback.default as Translations;
  }
}

export function t(translations: Translations, key: string, vars?: Record<string, string | number>): string {
  let str = translations[key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v));
    });
  }
  return str;
}
