import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const container = `zaff-migration-test-${process.pid}`;
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=local-test',
    '-e', 'POSTGRES_DB=zaff_test', 'postgres:17-alpine']);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres']).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Local Postgres did not start.');
  const files = ['scripts/test-deck-migration.sql', 'supabase/migrations/20261007192702_playable_saved_deck_cards.sql', 'scripts/assert-deck-migration.sql'];
  for (const file of files) {
    docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'zaff_test', '-v', 'ON_ERROR_STOP=1', ...(file.includes('assert-') ? [] : ['--single-transaction'])], readFileSync(file));
  }
  // Optionally exercise the prepared real-data backfill, still inside this disposable DB.
  if (process.argv[2]) {
    const decks = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
    let sql = 'delete from public.mazzi;\n';
    for (const deck of decks) {
      if (deck.created_by) sql += `insert into auth.users values (${quote(deck.created_by)}::uuid) on conflict do nothing;\n`;
      sql += `insert into public.mazzi(id,name,cards,source,format,colors,created_by) values (${quote(deck.id)},${quote(deck.name)},${quote(JSON.stringify(deck.cards))}::jsonb,${quote(deck.source ?? '')},${quote(deck.format ?? '')},${quote(JSON.stringify(deck.colors))}::jsonb,${deck.created_by ? quote(deck.created_by) + '::uuid' : 'null'});\n`;
      sql += `select public.backfill_deck_cards(${quote(deck.id)},0,${quote(JSON.stringify(deck.cards))}::jsonb,${quote(JSON.stringify(deck.enriched))}::jsonb);\n`;
    }
    sql += `select public.test_assert(not exists(select 1 from public."mazzi-cards" where scryfall_id is null or oracle_id is null or image_url is null or type_line is null),'real cards all resolved');\n`;
    sql += `select public.test_assert((select sum(qty) from public."mazzi-cards") = ${decks.reduce((n, d) => n + d.cards.reduce((n, c) => n + c.qty, 0), 0)},'real copies preserved');\n`;
    docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'zaff_test', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], sql);
  }
  console.log('Migration checks passed: parity, identities, permissions, rollback, conflicts and cascades.');
} finally {
  spawnSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
}
