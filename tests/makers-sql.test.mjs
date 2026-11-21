// The makers programme's database (docs/makers-programme.md), exercised for
// real: every migration is applied to a throwaway database, and
// supabase/tests/*.sql act as a guest, a maker, another maker and an admin.
//
// Needs psql and a Postgres to create that database in:
//   HP_TEST_DATABASE_URL=postgresql://postgres:…@localhost:5432/postgres node --test
// Without the variable (or without psql) the test is skipped. It never
// touches a database it didn't create.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ADMIN_URL = process.env.HP_TEST_DATABASE_URL;
const hasPsql = spawnSync('psql', ['--version']).status === 0;

function psql(url, args) {
  return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8' });
}

test('migrations apply in order and the makers SQL behaves', { skip: !ADMIN_URL || !hasPsql ? 'set HP_TEST_DATABASE_URL to run' : false }, () => {
  const name = `hp_test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const made = psql(ADMIN_URL, ['-c', `create database ${name}`]);
  assert.equal(made.status, 0, made.stderr);
  const u = new URL(ADMIN_URL);
  u.pathname = '/' + name;
  const url = u.toString();
  try {
    const files = [
      'supabase/tests/stubs.sql',
      ...readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => 'supabase/migrations/' + f),
    ];
    for (const f of files) {
      const r = psql(url, ['-1', '-f', path.join(ROOT, f)]);
      assert.equal(r.status, 0, `${f}\n${r.stderr}`);
    }
    // Twice: a migration must be safe to run again by hand.
    for (const f of files.slice(1)) {
      const r = psql(url, ['-1', '-f', path.join(ROOT, f)]);
      assert.equal(r.status, 0, `${f} (second run)\n${r.stderr}`);
    }
    for (const f of readdirSync(path.join(ROOT, 'supabase/tests')).filter(f => f.endsWith('.sql') && f !== 'stubs.sql').sort()) {
      const r = psql(url, ['-f', path.join(ROOT, 'supabase/tests', f)]);
      assert.equal(r.status, 0, `${f}\n${r.stderr}`);
    }
  } finally {
    psql(ADMIN_URL, ['-c', `drop database if exists ${name} with (force)`]);
  }
});

// Whatever the database: the rules every migration file must keep (CLAUDE.md,
// "Data and database"), checked on the text.
test('migrations are additive and every new table has row-level security', async () => {
  const { readFileSync } = await import('node:fs');
  const dir = path.join(ROOT, 'supabase/migrations');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql'))) {
    assert.match(f, /^\d{8}_[a-z0-9_]+\.sql$/, f);
    const sql = readFileSync(path.join(dir, f), 'utf8').replace(/--.*$/gm, '');
    assert.doesNotMatch(sql, /\bdrop\s+(table|column|function|policy|schema|index)\b/i, `${f}: nothing is dropped`);
    assert.doesNotMatch(sql, /\balter\s+table\s+[\w.]+\s+(drop|rename|alter)\b/i, `${f}: existing columns stay as they are`);
    assert.doesNotMatch(sql, /\btruncate\b/i, f);
    for (const m of sql.matchAll(/create table if not exists (public\.\w+)/g)) {
      assert.ok(sql.includes(`alter table ${m[1]} enable row level security`), `${f}: ${m[1]} has row-level security`);
    }
    for (const m of sql.matchAll(/create or replace function (public\.\w+)\(([^)]*)\)[\s\S]*?\$\$/g)) {
      const head = m[0];
      if (/security definer/.test(head)) assert.match(head, /set search_path = /, `${f}: ${m[1]} pins its search_path`);
    }
  }
});
