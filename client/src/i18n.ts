import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './locales/it/translation.json';
import en from './locales/en/translation.json';

void i18n.use(initReactI18next).init({
  resources: { it: { translation: it }, en: { translation: en } },
  lng: 'it',
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
});

export default i18n;

/**
 * Etichette in costanti di modulo (colori, tipi di carta…): la chiave del vocabolario si legge
 * ogni volta che si usa l'etichetta, così segue la lingua scelta (che si imposta dopo l'import).
 */
export function translatedLabels<K extends string>(keys: Record<K, string>): Record<K, string> {
  const labels = {} as Record<K, string>;
  for (const k of Object.keys(keys) as K[]) Object.defineProperty(labels, k, { get: () => i18n.t(keys[k]), enumerable: true });
  return labels;
}

/** Come `translatedLabels`, per un elemento con `label`: `label` si traduce a ogni lettura. */
export function withTranslatedLabel<T extends object>(item: T, key: string): T & { readonly label: string } {
  return Object.defineProperty({ ...item }, 'label', { get: () => i18n.t(key), enumerable: true }) as T & { readonly label: string };
}

/** Lingua in uso per date e numeri: italiano, oppure inglese britannico (date giorno/mese/anno). */
export const currentLocale = () => (i18n.language === 'en' ? 'en-GB' : 'it-IT');
