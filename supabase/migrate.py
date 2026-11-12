#!/usr/bin/env python3
"""Apply pending SQL migrations from supabase/migrations/ to the database.

Runs as part of build.py when HP_DATABASE_URL is set (Vercel → Project →
Settings → Environment Variables; see supabase/README.md). Can also be run
by hand: HP_DATABASE_URL=postgresql://… python3 supabase/migrate.py

- Files are applied in file-name order, each in its own transaction.
- Applied files are recorded in public._hp_migrations (file name, SHA-256,
  time), so each runs exactly once. A recorded file whose content changed
  afterwards is reported and skipped, never re-run: write a new file instead.
- A Postgres advisory lock stops two builds (production and a preview, say)
  migrating the same database at the same moment.
- Any failure stops the build, so code that needs a schema change is never
  deployed without it. The connection string is never printed.

Migrations are additive only (CLAUDE.md): new tables, columns, functions and
policies; never altering or dropping what exists.
"""
import hashlib
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIGRATIONS_DIR = os.path.join(ROOT, 'supabase', 'migrations')
DEPS_DIR = os.path.join(ROOT, '.build-deps')
PSYCOPG = 'psycopg[binary]==3.2.3'
LOCK_KEY = 'herbe-handpan-migrations'


def log(msg):
    print(f'[migrate] {msg}', flush=True)


def load_psycopg():
    if os.path.isdir(DEPS_DIR):
        sys.path.insert(0, DEPS_DIR)
    try:
        import psycopg  # noqa: F401
    except ImportError:
        # Vercel's build image has Python and pip but not the Postgres driver.
        log(f'installing {PSYCOPG} for this build')
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--quiet',
                               '--disable-pip-version-check', '--target', DEPS_DIR, PSYCOPG])
        if DEPS_DIR not in sys.path:
            sys.path.insert(0, DEPS_DIR)
    import psycopg
    return psycopg


def migration_files():
    if not os.path.isdir(MIGRATIONS_DIR):
        return []
    return sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.endswith('.sql'))


def run(url):
    psycopg = load_psycopg()
    files = migration_files()
    with psycopg.connect(url, autocommit=True, connect_timeout=20) as conn:
        conn.execute('select pg_advisory_lock(hashtext(%s))', (LOCK_KEY,))
        try:
            conn.execute("""
                create table if not exists public._hp_migrations (
                  filename   text primary key,
                  checksum   text not null,
                  applied_at timestamptz not null default now()
                )""")
            # Bookkeeping only; nobody signed in to the app may read or change it.
            conn.execute('alter table public._hp_migrations enable row level security')
            # Decode defensively: a database in SQL_ASCII returns bytes.
            text = lambda v: v.decode('utf-8') if isinstance(v, (bytes, bytearray)) else v
            applied = {text(f): text(c) for f, c in conn.execute('select filename, checksum from public._hp_migrations')}
            ran = 0
            for name in files:
                with open(os.path.join(MIGRATIONS_DIR, name), encoding='utf-8') as fh:
                    sql = fh.read()
                checksum = hashlib.sha256(sql.encode('utf-8')).hexdigest()
                if name in applied:
                    if applied[name] != checksum:
                        log(f'WARNING {name} changed after it was applied; not re-running it. '
                            'Put further changes in a new migration file.')
                    continue
                log(f'applying {name}')
                with conn.transaction():
                    # No parameters: psycopg sends the file as one simple query,
                    # so it may hold several statements and $$ function bodies.
                    conn.execute(sql)
                    conn.execute('insert into public._hp_migrations (filename, checksum) values (%s, %s)',
                                 (name, checksum))
                ran += 1
            log(f'{ran} applied, {len(files) - ran} already up to date')
        finally:
            conn.execute('select pg_advisory_unlock(hashtext(%s))', (LOCK_KEY,))


def main():
    url = os.environ.get('HP_DATABASE_URL')
    if not url:
        log('HP_DATABASE_URL is not set: skipping database migrations')
        return 0
    try:
        run(url)
    except Exception as err:  # report without echoing the connection string
        msg = str(err).replace(url, '<HP_DATABASE_URL>')
        log(f'FAILED: {type(err).__name__}: {msg}')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
