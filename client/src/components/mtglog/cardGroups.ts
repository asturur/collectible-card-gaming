import type { ScryCard } from '../../services/scryfall';

/** Ordinamento carte dei mazzi: prima per colore, poi per tipo, poi per nome. */

export type ColorGroupId = 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'C' | 'L' | '?';
export type TypeGroupId = 'spell' | 'creature' | 'artifact' | 'enchantment' | 'planeswalker' | 'other';

/** Ordine dei gruppi colore: i cinque colori nell'ordine WUBRG, poi le carte
 *  multicolore, poi gli incolori (artefatti ecc.), infine le terre. Le carte
 *  non ancora riconosciute da Scryfall restano in fondo. */
export const COLOR_GROUPS: { id: ColorGroupId; label: string; stripe: string }[] = [
  { id: 'W', label: 'Bianco', stripe: '#f3e9b5' },
  { id: 'U', label: 'Blu', stripe: '#3b82f6' },
  { id: 'B', label: 'Nero', stripe: '#8b8fa3' },
  { id: 'R', label: 'Rosso', stripe: '#ef4444' },
  { id: 'G', label: 'Verde', stripe: '#22c55e' },
  { id: 'M', label: 'Multicolore', stripe: '#f5c451' },
  { id: 'C', label: 'Incolore', stripe: '#94a3b8' },
  { id: 'L', label: 'Terre', stripe: '#b7791f' },
  { id: '?', label: 'Non classificate', stripe: '#475569' },
];

/** Ordine dei tipi dentro ogni colore: istantanei e stregonerie, creature,
 *  artefatti, poi il resto. */
export const TYPE_GROUPS: { id: TypeGroupId; label: string }[] = [
  { id: 'spell', label: 'Istantanei e Stregonerie' },
  { id: 'creature', label: 'Creature' },
  { id: 'artifact', label: 'Artefatti' },
  { id: 'enchantment', label: 'Incantesimi' },
  { id: 'planeswalker', label: 'Planeswalker' },
  { id: 'other', label: 'Altro' },
];

/** Tipo di una carta dalla riga dei tipi. Se ne ha più di uno vince il primo
 *  di questa lista (come nei raggruppamenti di ManaBox): terra, creatura,
 *  planeswalker, istantaneo/stregoneria, artefatto, incantesimo. */
function typeOf(typeLine: string): TypeGroupId | 'land' {
  const t = typeLine.toLowerCase();
  if (t.includes('land')) return 'land';
  if (t.includes('creature')) return 'creature';
  if (t.includes('planeswalker')) return 'planeswalker';
  if (t.includes('instant') || t.includes('sorcery')) return 'spell';
  if (t.includes('artifact')) return 'artifact';
  if (t.includes('enchantment')) return 'enchantment';
  return 'other';
}

export function classify(card: ScryCard | undefined): { color: ColorGroupId; type: TypeGroupId } {
  if (!card) return { color: '?', type: 'other' };
  const type = typeOf(card.typeLine);
  if (type === 'land') return { color: 'L', type: 'other' };
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

/** Raggruppa per colore → tipo → nome. `qty` serve per i totali. */
export function groupCards<T extends { name: string; qty: number }>(
  items: T[],
  lookup: (name: string) => ScryCard | undefined
): GroupedColor<T>[] {
  const buckets = new Map<string, T[]>();
  items.forEach((item) => {
    const { color, type } = classify(lookup(item.name));
    const key = color + '|' + type;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  });

  const result: GroupedColor<T>[] = [];
  COLOR_GROUPS.forEach((cg) => {
    const types: GroupedType<T>[] = [];
    TYPE_GROUPS.forEach((tg) => {
      const list = buckets.get(cg.id + '|' + tg.id);
      if (!list || list.length === 0) return;
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      types.push({ id: tg.id, label: tg.label, total: sorted.reduce((s, c) => s + c.qty, 0), items: sorted });
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
