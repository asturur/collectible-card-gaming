import { describe, expect, it } from 'vitest';
import { rekeyCommander } from './commanderKeys';

describe('rekeyCommander', () => {
  it('follows a renamed player and drops a removed one', () => {
    const byRow = rekeyCommander(
      { tax: 4, damage: { Bob: 5, Carla: 3 } },
      new Map([['Alice', 'r1'], ['Bob', 'r2'], ['Carla', 'r3']])
    );
    expect(byRow).toEqual({ tax: 4, damage: { r2: 5, r3: 3 } });

    // In editor: Bob diventa "Roberto", Carla viene rimossa.
    const byName = rekeyCommander(byRow, new Map([['r1', 'Alice'], ['r2', 'Roberto']]));
    expect(byName).toEqual({ tax: 4, damage: { Roberto: 5 } });
  });
});
