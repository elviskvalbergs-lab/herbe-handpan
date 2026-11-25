#!/usr/bin/env python3
import re, os

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(path):
    with open(os.path.join(ROOT, path)) as f:
        return f.read()

def strip_modules(js):
    # Remove multi-line and single-line imports (import ... from '...';)
    js = re.sub(r'import\s+\{[^}]*\}\s+from\s+["\'][^"\']+["\'];?\s*\n?', '', js, flags=re.DOTALL)
    js = re.sub(r'^import\s+.*?;?\s*$', '', js, flags=re.MULTILINE)
    # Remove export keyword from declarations
    js = re.sub(r'^export\s+(default\s+)?', '', js, flags=re.MULTILINE)
    return js

# Database migrations first: with DATABASE_URL set (Vercel builds), pending
# files in supabase/migrations/ are applied, and a failure stops the build so
# code that needs a schema change never deploys without it. Without the
# variable (local builds) this step is skipped. See supabase/README.md.
if os.environ.get('DATABASE_URL'):
    import subprocess, sys
    if subprocess.call([sys.executable, os.path.join(ROOT, 'supabase', 'migrate.py')]) != 0:
        sys.exit('Database migration failed: build stopped.')

# styles.css and the parts the website shares (css/)
# The fingering diagram's rules come first: they used to open the second half
# of styles.css, and nothing before them touched the diagram (same cascade).
css = read('css/fingering.css') + '\n' + read('styles.css') + '\n' + read('css/pan-drawing.css')

# JS files in dependency order
js_files = ['js/data.js', 'js/features.js', 'js/helpdoc.js', 'js/pickmatch.js', 'js/icons.js', 'js/brand.js', 'js/chords.js', 'js/harmony.js', 'js/songs.js', 'js/scalefinder.js', 'js/setup.js', 'js/chordsheet.js', 'js/ocarina.js', 'js/tuner.js', 'js/listen-detect.js', 'js/listen-audio.js', 'js/charts.js', 'js/tonguedrums.js', 'js/kalimbas.js', 'js/layoutfamilies.js', 'js/links.js', 'js/makers.js', 'js/datastore.js', 'js/sync.js', 'js/instruments.js', 'js/builder.js', 'js/audio.js', 'js/pan.js', 'js/ocarina-ui.js', 'js/storage.js', 'js/auth.js', 'js/localdb.js', 'js/offline.js', 'js/store.js', 'js/makers-ui.js', 'js/app/state.js', 'js/app/actions.js', 'js/app.js']
js_parts = []
for f in js_files:
    raw = read(f)
    stripped = strip_modules(raw)
    js_parts.append(f'// ── {f} ──\n' + stripped)

js_bundle = '\n\n'.join(js_parts)

# The bundle is one script scope, so a top-level name used in two files would
# break the whole app (a duplicate const stops the script; a duplicate function
# silently replaces the first). Checked here so it never deploys.
_seen = {}
for f, part in zip(js_files, js_parts):
    for m in re.finditer(r'^(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)', part, flags=re.MULTILINE):
        if m.group(1) in _seen and _seen[m.group(1)] != f:
            raise SystemExit(f'Build stopped: top-level name "{m.group(1)}" is in both {_seen[m.group(1)]} and {f}.')
        _seen.setdefault(m.group(1), f)

# Preview builds can point at a separate Supabase test project (see
# supabase/README.md). Only set these for Vercel's Preview environment.
_supa_url = os.environ.get('HP_SUPABASE_URL')
_supa_key = os.environ.get('HP_SUPABASE_KEY')
if _supa_url and _supa_key:
    js_bundle = re.sub(r"const _SUPA_URL = '[^']*';", f"const _SUPA_URL = '{_supa_url}';", js_bundle)
    js_bundle = re.sub(r"const _SUPA_KEY = '[^']*';", f"const _SUPA_KEY = '{_supa_key}';", js_bundle)
    print('Using Supabase project from HP_SUPABASE_URL')

# Error reporting (Sentry project oakhum-app, EU region). Vercel sets
# VERCEL_ENV (production / preview) and the commit; a local build is
# "development" and samples every trace.
_sentry_env = os.environ.get('VERCEL_ENV') or 'development'
_sentry_release = 'oakhum-app@' + (os.environ.get('VERCEL_GIT_COMMIT_SHA') or 'local')[:12]
_sentry_traces = '1.0' if _sentry_env == 'development' else '0.1'

# The help articles (help/en/*.md) go into the page, so the help sheet opens
# with no connection (js/helpdoc.js HELP_BUNDLE; docs/help-centre.md).
import json
_help_dir = os.path.join(ROOT, 'help', 'en')
_help = {f[:-3]: read(os.path.join('help', 'en', f)) for f in sorted(os.listdir(_help_dir)) if f.endswith('.md')}
assert 'const HELP_BUNDLE = null;' in js_bundle, 'js/helpdoc.js must declare HELP_BUNDLE'
js_bundle = js_bundle.replace('const HELP_BUNDLE = null;', 'const HELP_BUNDLE = ' + json.dumps(_help, ensure_ascii=False).replace('</', '<\\/') + ';')

# The offline cache's version: a hash of everything in the page, so each
# build gets a fresh service worker and precache (sw.js?v=…, js/offline.js).
import hashlib
_build_hash = hashlib.sha256((css + js_bundle).encode()).hexdigest()[:12]
js_bundle = js_bundle.replace("const BUILD_HASH = 'dev';", f"const BUILD_HASH = '{_build_hash}';")

# supabase-js is pinned (and precached by sw.js, which names the same URL).
SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js'
assert SUPABASE_JS in read('sw.js'), 'sw.js must precache the same supabase-js as build.py'
# Its Subresource Integrity hash: the browser refuses the file if the CDN ever
# serves anything else. It is the SHA-384 of exactly that version (it matches
# the SHA-256 jsDelivr publishes for the file); change both lines together
# when the version changes:
#   curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A
SUPABASE_JS_SRI = 'sha384-rwykjmWNwVxboyFmvK9OXN0wj9hnMHA2aAHtits54DuACyCq0M2PrSNxhRb+hvXT'
assert '@2.49.4/' in SUPABASE_JS, 'supabase-js changed version: update SUPABASE_JS_SRI as well'

html = f'''<!DOCTYPE html>
<html lang="en" data-theme="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Oakhum</title>
  <meta name="description" content="Chords and songs for the exact handpan, tongue drum, kalimba, ocarina, flute or recorder you own. Free, in your browser.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Oakhum">
  <meta property="og:title" content="Oakhum">
  <meta property="og:description" content="Chords and songs for the exact handpan, tongue drum, kalimba, ocarina, flute or recorder you own. Free, in your browser.">
  <meta property="og:image" content="/og/app.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icon-180.png">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Oakhum">
  <meta name="theme-color" content="#1C1B16">
  <script>
    // The theme pref before first paint (applyTheme() in app.js keeps it in step).
    try {{ var t = JSON.parse(localStorage.getItem('hp-prefs') || '{{}}').theme; if (t === 'dark' || t === 'light' || t === 'auto') document.documentElement.dataset.theme = t; }} catch (e) {{}}
  </script>
  <script>
    // Errors go to Sentry (project oakhum-app). The loader below fetches the
    // SDK after the page has loaded. Session replay is off (it needs consent,
    // docs/free-to-play.md §9) and the project doesn't store IP addresses.
    window.sentryOnLoad = function () {{
      Sentry.init({{
        environment: '{_sentry_env}',
        release: '{_sentry_release}',
        tracesSampleRate: {_sentry_traces},
        sendDefaultPii: false,
      }});
    }};
  </script>
  <script src="https://js-de.sentry-cdn.com/61ab240ada1884d0c6ce945b07d50e33.min.js" crossorigin="anonymous"></script>
  <script defer src="/_vercel/insights/script.js"></script>
  <link rel="preload" href="/fonts/oakhum-text-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/oakhum-text-600.woff2" as="font" type="font/woff2" crossorigin>
  <style>
{css}
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="{SUPABASE_JS}" integrity="{SUPABASE_JS_SRI}" crossorigin="anonymous"></script>
  <script>
{js_bundle}
  </script>
</body>
</html>'''

out = os.path.join(ROOT, 'index.html')
with open(out, 'w') as f:
    f.write(html)

# The bundle must at least parse: a syntax error would deploy a blank app.
import shutil, subprocess, tempfile
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as _tmp:
        _tmp.write(js_bundle)
    _ok = subprocess.call(['node', '--check', _tmp.name]) == 0
    os.unlink(_tmp.name)
    if not _ok:
        raise SystemExit('Build stopped: the bundled script does not parse.')

print(f'Built {out} ({len(html)//1024}KB)')
