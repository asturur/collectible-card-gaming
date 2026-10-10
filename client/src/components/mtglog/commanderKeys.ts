import type { CommanderCount } from './LifeCounter';

/**
 * Cambia la chiave dei danni da comandante (chi li ha inflitti): dal nome alla riga
 * dell'editor e ritorno. Così un giocatore rinominato in "Modifica Partita" conserva
 * i danni inflitti agli altri; quelli di una riga rimossa spariscono con lei.
 */
export function rekeyCommander(count: CommanderCount, keys: ReadonlyMap<string, string>): CommanderCount {
  const damage: Record<string, number> = {};
  for (const [from, value] of Object.entries(count.damage)) {
    const to = keys.get(from);
    if (to) damage[to] = value;
  }
  return { tax: count.tax, damage };
}
