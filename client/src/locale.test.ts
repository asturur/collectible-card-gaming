import { describe, expect, it } from 'vitest';
import i18n from './i18n';
import { localeBase, localeFromPath } from './router';

describe('locale routing and translations', () => {
  it('recognizes supported language prefixes under the app base', () => {
    expect(localeFromPath(`${localeBase('en')}/games`)).toBe('en');
    expect(localeFromPath(`${localeBase('it')}/games`)).toBe('it');
    expect(localeFromPath(`${localeBase('it')}alian/games`)).toBeNull();
  });

  it('provides the home action in both languages', () => {
    expect(i18n.getFixedT('it')('nuova_partita')).toBe('Nuova Partita');
    expect(i18n.getFixedT('en')('nuova_partita')).toBe('New Game');
  });
});
