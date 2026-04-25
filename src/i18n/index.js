import en from './en.js';
import id from './id.js';
import es from './es.js';
import ru from './ru.js';
import th from './th.js';
import ja from './ja.js';
import fr from './fr.js';
import vi from './vi.js';
import zh from './zh.js';
import ko from './ko.js';
import de from './de.js';

const packs = { en, id, es, ru, th, ja, fr, vi, zh, ko, de };

const langNames = {
  en: 'English',
  id: 'Bahasa',
  es: 'Español',
  ru: 'Русский',
  th: 'ไทย',
  ja: '日本語',
  fr: 'Français',
  vi: 'Tiếng Việt',
  zh: '中文',
  ko: '한국어',
  de: 'Deutsch'
};

let currentLang = localStorage.getItem('bom-lang') || 'en';

export function t(key, ...args) {
  const str = (packs[currentLang] && packs[currentLang][key]) || en[key] || key;
  return args.reduce((s, v, i) => s.replace(`{${i}}`, v), str);
}

export function getLang() { return currentLang; }

export function setLang(lang) {
  if (!packs[lang]) return;
  currentLang = lang;
  localStorage.setItem('bom-lang', lang);
  applyAll();
}

export function getAvailableLangs() {
  return Object.keys(packs).map(code => ({ code, name: langNames[code] }));
}

export function applyAll() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.documentElement.lang = currentLang;
}
