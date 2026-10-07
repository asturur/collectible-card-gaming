import type { ScryCard, ScryToken } from '../../services/scryfall';
import { classify, TYPE_GROUPS, type TypeGroupId } from './cardGroups';

/** Statistiche del Main Deck (la riserva non conta). Solo le carte già
 *  riconosciute da Scryfall entrano nei conti; `unknown` dice quante no. */

export type ManaKey = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type CurveKey = ManaKey | 'M';

export const MANA_ORDER: ManaKey[] = ['W', 'U', 'B', 'R', 'G', 'C'];

/** Colori dei grafici: verde per il verde, rosso per il rosso… */
export const MANA_COLORS: Record<CurveKey, string> = {
  W: '#f8f4d6',
  U: '#3b82f6',
  B: '#6b5b7b',
  R: '#ef4444',
  G: '#22c55e',
  C: '#94a3b8',
  M: '#f5c451',
};

export const MANA_LABELS: Record<CurveKey, string> = {
  W: 'Bianco',
  U: 'Blu',
  B: 'Nero',
  R: 'Rosso',
  G: 'Verde',
  C: 'Incolore',
  M: 'Multicolore',
};

export const TYPE_COLORS: Record<TypeGroupId, string> = {
  instant: '#38bdf8',
  sorcery: '#e879f9',
  creature: '#fb923c',
  artifact: '#94a3b8',
  enchantment: '#facc15',
  planeswalker: '#a78bfa',
  other: '#64748b',
  land: '#b7791f',
};

export interface CurveBar {
  /** 0…7: l'ultimo raccoglie anche i valori più alti ("7+"). */
  value: number;
  total: number;
  segments: { key: CurveKey; n: number }[];
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface SubtypeChart {
  title: string;
  rows: { name: string; n: number }[];
  /** Quanti sottotipi in più non sono mostrati. */
  hidden: number;
}

export interface DeckStats {
  /** Copie nel Main Deck, e quante di queste non sono state riconosciute. */
  total: number;
  unknown: number;
  curve: CurveBar[];
  costPie: Slice[];
  /** Mana generico dei costi ({2}, {3}…), per copia: serve al conteggio opzionale dell'incolore. */
  genericCost: number;
  productionPie: Slice[];
  typePie: Slice[];
  subtypes: SubtypeChart[];
}

const CURVE_MAX = 7;
const MAX_SUBTYPES = 15;
const COLOR_LETTERS = 'WUBRG';

/** Simboli colorati di un costo ("{2}{G}{G}" → G 2): un simbolo ibrido come
 *  {W/U} pesa mezzo punto per colore; il mana generico non conta; {C} è incolore. */
function costPips(manaCost: string): Partial<Record<ManaKey, number>> {
  const pips: Partial<Record<ManaKey, number>> = {};
  const symbols = manaCost.match(/\{[^}]+\}/g) ?? [];
  symbols.forEach((sym) => {
    const parts = sym.slice(1, -1).split('/');
    const colors = parts.filter((p) => COLOR_LETTERS.includes(p) && p.length === 1) as ManaKey[];
    if (colors.length > 0) {
      colors.forEach((c) => (pips[c] = (pips[c] ?? 0) + 1 / colors.length));
    } else if (parts.length === 1 && parts[0] === 'C') {
      pips.C = (pips.C ?? 0) + 1;
    }
  });
  return pips;
}

/** Mana generico di un costo ("{2}{G}{G}" → 2); {X} non conta. */
function genericPips(manaCost: string): number {
  return (manaCost.match(/\{(\d+)\}/g) ?? []).reduce((sum, sym) => sum + Number(sym.slice(1, -1)), 0);
}

/** Sottotipi: le parole dopo il trattino della riga dei tipi. */
function subtypesOf(typeLine: string): string[] {
  const dash = typeLine.indexOf('—');
  if (dash < 0) return [];
  return typeLine
    .slice(dash + 1)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const SUBTYPE_TITLES: Partial<Record<TypeGroupId, string>> = {
  creature: 'Creature',
  land: 'Terre',
  artifact: 'Artefatti',
  enchantment: 'Incantesimi',
  instant: 'Istantanei',
  sorcery: 'Stregonerie',
  planeswalker: 'Planeswalker',
};

export function computeDeckStats(
  cards: { name: string; scryfallId?: string | null; qty: number; section?: string }[],
  lookup: (name: string, scryfallId?: string | null) => ScryCard | undefined
): DeckStats {
  const main = cards.filter((c) => c.section !== 'side');
  let total = 0;
  let unknown = 0;

  const curveMap = new Map<number, Map<CurveKey, number>>();
  const cost: Record<ManaKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  let genericCost = 0;
  const production: Record<ManaKey, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const typeCount = new Map<TypeGroupId, number>();
  const subtypeCount = new Map<TypeGroupId, Map<string, number>>();

  main.forEach((item) => {
    total += item.qty;
    const card = lookup(item.name, item.scryfallId);
    if (!card) {
      unknown += item.qty;
      return;
    }
    const { color, type } = classify(card);

    typeCount.set(type, (typeCount.get(type) ?? 0) + item.qty);

    // Istogramma del valore di mana: senza terre; le multicolore in oro.
    if (type !== 'land') {
      const bucket = Math.min(Math.max(Math.round(card.cmc), 0), CURVE_MAX);
      const key = color as CurveKey;
      const segs = curveMap.get(bucket) ?? new Map<CurveKey, number>();
      segs.set(key, (segs.get(key) ?? 0) + item.qty);
      curveMap.set(bucket, segs);
    }

    // Costi: simboli colorati, per copia.
    const pips = costPips(card.manaCost);
    (Object.keys(pips) as ManaKey[]).forEach((k) => (cost[k] += (pips[k] ?? 0) * item.qty));
    genericCost += genericPips(card.manaCost) * item.qty;

    // Produzione: ogni fonte vale 1 in tutto, divisa in parti uguali tra i
    // colori che può fare (una terra doppia = ½ + ½, tripla = ⅓ ciascuno…),
    // perché ne produce uno solo alla volta.
    const made = [...new Set(card.produced)].filter((c): c is ManaKey => 'WUBRGC'.includes(c) && c.length === 1);
    if (made.length > 0) made.forEach((c) => (production[c] += item.qty / made.length));

    // Sottotipi, raggruppati per il tipo principale della carta.
    const subs = subtypesOf(card.typeLine);
    if (subs.length > 0) {
      const map = subtypeCount.get(type) ?? new Map<string, number>();
      subs.forEach((s) => map.set(s, (map.get(s) ?? 0) + item.qty));
      subtypeCount.set(type, map);
    }
  });

  const curve: CurveBar[] = [];
  for (let v = 0; v <= CURVE_MAX; v++) {
    const segs = curveMap.get(v);
    const segments = (['W', 'U', 'B', 'R', 'G', 'M', 'C'] as CurveKey[])
      .map((key) => ({ key, n: segs?.get(key) ?? 0 }))
      .filter((s) => s.n > 0);
    curve.push({ value: v, total: segments.reduce((s, x) => s + x.n, 0), segments });
  }

  const manaSlices = (data: Record<ManaKey, number>): Slice[] =>
    MANA_ORDER.filter((k) => data[k] > 0).map((k) => ({
      key: k,
      label: MANA_LABELS[k],
      value: data[k],
      color: MANA_COLORS[k],
    }));

  const typePie: Slice[] = TYPE_GROUPS.filter((t) => (typeCount.get(t.id) ?? 0) > 0).map((t) => ({
    key: t.id,
    label: t.label,
    value: typeCount.get(t.id) ?? 0,
    color: TYPE_COLORS[t.id],
  }));

  const subtypes: SubtypeChart[] = [];
  TYPE_GROUPS.forEach((t) => {
    const map = subtypeCount.get(t.id);
    const title = SUBTYPE_TITLES[t.id];
    if (!map || !title) return;
    const rows = [...map.entries()]
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'en'));
    subtypes.push({ title, rows: rows.slice(0, MAX_SUBTYPES), hidden: Math.max(0, rows.length - MAX_SUBTYPES) });
  });

  return {
    total,
    unknown,
    curve,
    costPie: manaSlices(cost),
    genericCost,
    productionPie: manaSlices(production),
    typePie,
    subtypes,
  };
}

export interface TokenGroup {
  key: string;
  /** Es. "Human 2/2". */
  label: string;
  /** Testo del token (abilità), se ne ha. */
  text: string;
  token: ScryToken;
  /** Quante carte del mazzo (con le copie) lo possono creare. */
  count: number;
  cards: { name: string; scryfallId?: string | null; qty: number }[];
}

/** Token che le carte del Main Deck possono creare. Tokens uguali (stesso
 *  nome, forza/costituzione, colori e testo) si sommano anche se vengono da
 *  stampe diverse. `pending` = token ancora in arrivo da Scryfall. */
export function computeTokens(
  cards: { name: string; scryfallId?: string | null; qty: number; section?: string }[],
  lookup: (name: string, scryfallId?: string | null) => ScryCard | undefined,
  lookupToken: (id: string) => ScryToken | undefined
): { groups: TokenGroup[]; pending: number } {
  const groups = new Map<string, TokenGroup & { seen: Set<string> }>();
  let pending = 0;
  cards
    .filter((c) => c.section !== 'side')
    .forEach((item) => {
      const card = lookup(item.name, item.scryfallId);
      if (!card) return;
      card.tokens.forEach((tk) => {
        const tok = lookupToken(tk.id);
        if (!tok) {
          pending++;
          return;
        }
        const key = [tok.name, tok.power, tok.toughness, tok.colors.join(''), tok.oracle].join('|');
        let g = groups.get(key);
        if (!g) {
          const pt = tok.power || tok.toughness ? ` ${tok.power}/${tok.toughness}` : '';
          g = { key, label: tok.name + pt, text: tok.oracle, token: tok, count: 0, cards: [], seen: new Set() };
          groups.set(key, g);
        }
        if (g.seen.has(item.name)) return;
        g.seen.add(item.name);
        g.count += item.qty;
        g.cards.push({ name: item.name, qty: item.qty });
      });
    });
  const list = [...groups.values()].map(({ seen: _seen, ...rest }) => ({
    ...rest,
    cards: [...rest.cards].sort((a, b) => a.name.localeCompare(b.name, 'en')),
  }));
  list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'));
  return { groups: list, pending };
}
