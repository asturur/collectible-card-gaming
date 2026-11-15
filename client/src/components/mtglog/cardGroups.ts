import type { ScryCard } from '../../services/scryfall';
import { withTranslatedLabel } from '../../i18n';

/** Ordinamento carte dei mazzi: prima per colore, poi per tipo, poi per nome. */

export type ColorGroupId = 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'C' | 'L' | '?';
export type TypeGroupId =
  | 'instant'
  | 'sorcery'
  | 'creature'
  | 'artifact'
  | 'enchantment'
  | 'planeswalker'
  | 'other'
  | 'land';

/** Come raggruppare: per colore (poi tipo) oppure direttamente per tipo. */
export type GroupMode = 'color' | 'type';

/** Ordine dei gruppi colore: i cinque colori nell'ordine WUBRG, poi le carte
 *  multicolore, poi gli incolori (artefatti ecc.), infine le terre. Le carte
 *  non ancora riconosciute da Scryfall restano in fondo. */
export const COLOR_GROUPS: { id: ColorGroupId; label: string; stripe: string }[] = [
  withTranslatedLabel({ id: 'W' as const, stripe: '#f3e9b5' }, 'bianco'),
  withTranslatedLabel({ id: 'U' as const, stripe: '#3b82f6' }, 'blu'),
  withTranslatedLabel({ id: 'B' as const, stripe: '#8b8fa3' }, 'nero'),
  withTranslatedLabel({ id: 'R' as const, stripe: '#ef4444' }, 'rosso'),
  withTranslatedLabel({ id: 'G' as const, stripe: '#22c55e' }, 'verde'),
  withTranslatedLabel({ id: 'M' as const, stripe: '#f5c451' }, 'multicolore'),
  withTranslatedLabel({ id: 'C' as const, stripe: '#94a3b8' }, 'incolore'),
  withTranslatedLabel({ id: 'L' as const, stripe: '#b7791f' }, 'terre'),
  withTranslatedLabel({ id: '?' as const, stripe: '#475569' }, 'non_classificate'),
];

/** Ordine dei tipi: istantanei, stregonerie, creature, artefatti, poi il
 *  resto. Le terre, quando contano come tipo (vista per tipo), stanno in fondo. */
export const TYPE_GROUPS: { id: TypeGroupId; label: string }[] = [
  withTranslatedLabel({ id: 'instant' as const }, 'istantanei'),
  withTranslatedLabel({ id: 'sorcery' as const }, 'stregonerie'),
  withTranslatedLabel({ id: 'creature' as const }, 'creature'),
  withTranslatedLabel({ id: 'artifact' as const }, 'artefatti'),
  withTranslatedLabel({ id: 'enchantment' as const }, 'incantesimi'),
  withTranslatedLabel({ id: 'planeswalker' as const }, 'planeswalker'),
  withTranslatedLabel({ id: 'other' as const }, 'altro_tipo'),
  withTranslatedLabel({ id: 'land' as const }, 'terre'),
];

/** Tipo di una carta dalla riga dei tipi. Se ne ha più di uno vince il primo
 *  di questa lista (come nei raggruppamenti di ManaBox): terra, creatura,
 *  planeswalker, istantaneo/stregoneria, artefatto, incantesimo. */
function typeOf(typeLine: string): TypeGroupId {
  const t = typeLine.toLowerCase();
  if (t.includes('land')) return 'land';
  if (t.includes('creature')) return 'creature';
  if (t.includes('planeswalker')) return 'planeswalker';
  if (t.includes('instant')) return 'instant';
  if (t.includes('sorcery')) return 'sorcery';
  if (t.includes('artifact')) return 'artifact';
  if (t.includes('enchantment')) return 'enchantment';
  return 'other';
}

export function classify(card: ScryCard | undefined): { color: ColorGroupId; type: TypeGroupId } {
  if (!card) return { color: '?', type: 'other' };
  const type = typeOf(card.typeLine);
  if (type === 'land') return { color: 'L', type: 'land' };
  const colors = card.colors.filter((c) => 'WUBRG'.includes(c));
  const color: ColorGroupId = colors.length === 0 ? 'C' : colors.length > 1 ? 'M' : (colors[0] as ColorGroupId);
  return { color, type };
}

export interface GroupedType<T> {
  id: TypeGroupId;
  label: string;
  total: number;
  items: T[];
}

export interface GroupedColor<T> {
  id: ColorGroupId;
  label: string;
  stripe: string;
  total: number;
  /** Per terre e non classificate c'è un solo blocco, senza intestazione di tipo. */
  showTypes: boolean;
  types: GroupedType<T>[];
}

/** Raggruppa per colore → tipo → nome (`mode` 'color') oppure per tipo → nome
 *  (`mode` 'type'). `qty` serve per i totali. */
export function groupCards<T extends { name: string; scryfallId?: string | null; qty: number }>(
  items: T[],
  lookup: (name: string, scryfallId?: string | null) => ScryCard | undefined,
  mode: GroupMode = 'color'
): GroupedColor<T>[] {
  const alpha = (list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const sum = (list: T[]) => list.reduce((s, c) => s + c.qty, 0);

  if (mode === 'type') {
    const byType = new Map<string, T[]>();
    items.forEach((item) => {
      const card = lookup(item.name, item.scryfallId);
      const key = card ? classify(card).type : '?';
      byType.set(key, [...(byType.get(key) ?? []), item]);
    });
    const out: GroupedColor<T>[] = [];
    [...TYPE_GROUPS, withTranslatedLabel({ id: '?' as const }, 'non_classificate')].forEach((tg) => {
      const list = byType.get(tg.id);
      if (!list || list.length === 0) return;
      const sorted = alpha(list);
      out.push({
        id: tg.id as ColorGroupId,
        label: tg.label,
        stripe: tg.id === 'land' ? '#b7791f' : tg.id === '?' ? '#475569' : '#a78bfa',
        total: sum(sorted),
        showTypes: false,
        types: [{ id: 'other', label: tg.label, total: sum(sorted), items: sorted }],
      });
    });
    return out;
  }

  const buckets = new Map<string, T[]>();
  items.forEach((item) => {
    const { color, type } = classify(lookup(item.name, item.scryfallId));
    const key = color + '|' + type;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  });

  const result: GroupedColor<T>[] = [];
  COLOR_GROUPS.forEach((cg) => {
    const types: GroupedType<T>[] = [];
    TYPE_GROUPS.forEach((tg) => {
      const list = buckets.get(cg.id + '|' + tg.id);
      if (!list || list.length === 0) return;
      const sorted = alpha(list);
      types.push({ id: tg.id, label: tg.label, total: sum(sorted), items: sorted });
    });
    if (types.length === 0) return;
    result.push({
      id: cg.id,
      label: cg.label,
      stripe: cg.stripe,
      total: types.reduce((s, t) => s + t.total, 0),
      showTypes: cg.id !== 'L' && cg.id !== '?',
      types,
    });
  });
  return result;
}
