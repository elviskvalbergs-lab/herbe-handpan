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
    js = re.sub(r'\bexport\s+(default\s+)?', '', js)
    return js

# Database migrations first: with HP_DATABASE_URL set (Vercel builds), pending
# files in supabase/migrations/ are applied, and a failure stops the build so
# code that needs a schema change never deploys without it. Without the
# variable (local builds) this step is skipped. See supabase/README.md.
if os.environ.get('HP_DATABASE_URL'):
    import subprocess, sys
    if subprocess.call([sys.executable, os.path.join(ROOT, 'supabase', 'migrate.py')]) != 0:
        sys.exit('Database migration failed: build stopped.')

css = read('styles.css')

# JS files in dependency order
js_files = ['js/data.js', 'js/icons.js', 'js/chords.js', 'js/ocarina.js', 'js/tuner.js', 'js/charts.js', 'js/instruments.js', 'js/builder.js', 'js/audio.js', 'js/pan.js', 'js/ocarina-ui.js', 'js/storage.js', 'js/auth.js', 'js/app.js']
js_parts = []
for f in js_files:
    raw = read(f)
    stripped = strip_modules(raw)
    js_parts.append(f'// ── {f} ──\n' + stripped)

js_bundle = '\n\n'.join(js_parts)

# Preview builds can point at a separate Supabase test project (see
# supabase/README.md). Only set these for Vercel's Preview environment.
_supa_url = os.environ.get('HP_SUPABASE_URL')
_supa_key = os.environ.get('HP_SUPABASE_KEY')
if _supa_url and _supa_key:
    js_bundle = re.sub(r"const _SUPA_URL = '[^']*';", f"const _SUPA_URL = '{_supa_url}';", js_bundle)
    js_bundle = re.sub(r"const _SUPA_KEY = '[^']*';", f"const _SUPA_KEY = '{_supa_key}';", js_bundle)
    print('Using Supabase project from HP_SUPABASE_URL')

html = f'''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Handpan Chords</title>
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/icon.svg">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Handpan">
  <meta name="theme-color" content="#090F0D">
  <script>
    // The theme pref before first paint (applyTheme() in app.js keeps it in step).
    try {{ var t = JSON.parse(localStorage.getItem('hp-prefs') || '{{}}').theme; if (t === 'light' || t === 'auto') document.documentElement.dataset.theme = t; }} catch (e) {{}}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
{css}
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script>
{js_bundle}
  </script>
  <script>
    if ('serviceWorker' in navigator) {{
      navigator.serviceWorker.register('/sw.js');
    }}
  </script>
</body>
</html>'''

out = os.path.join(ROOT, 'index.html')
with open(out, 'w') as f:
    f.write(html)

print(f'Built {out} ({len(html)//1024}KB)')
