import { describe, expect, it } from 'vitest';
import i18n from './i18n';
import { localeBase, localeFromPath } from './router';

describe('locale routing and translations', () => {
  it('recognizes supported language prefixes under the app base', () => {
    expect(localeFromPath(`${localeBase('en')}/games`)).toBe('en');
    expect(localeFromPath(`${localeBase('it')}/games`)).toBe('it');
    expect(localeFromPath(`${localeBase('it')}alian/games`)).toBeNull();
  });

  it('has the same keys in Italian and English, so no text is missing in either language', async () => {
    const it_ = (await import('./locales/it/translation.json')).default as Record<string, string>;
    const en = (await import('./locales/en/translation.json')).default as Record<string, string>;
    expect(Object.keys(en).sort()).toEqual(Object.keys(it_).sort());
    expect(Object.entries({ ...it_, ...en }).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it('uses the plural forms of each language', () => {
    expect(i18n.getFixedT('it')('carte', { count: 1 })).toBe('1 carta');
    expect(i18n.getFixedT('it')('carte', { count: 3 })).toBe('3 carte');
    expect(i18n.getFixedT('en')('carte', { count: 1 })).toBe('1 card');
    expect(i18n.getFixedT('en')('carte', { count: 3 })).toBe('3 cards');
  });

  it('provides the home action in both languages', () => {
    expect(i18n.getFixedT('it')('nuova_partita')).toBe('Nuova Partita');
    expect(i18n.getFixedT('en')('nuova_partita')).toBe('New Game');
  });
});
