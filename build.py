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

css = read('styles.css')

# JS files in dependency order
js_files = ['js/data.js', 'js/chords.js', 'js/audio.js', 'js/pan.js', 'js/app.js']
js_parts = []
for f in js_files:
    raw = read(f)
    stripped = strip_modules(raw)
    js_parts.append(f'// ── {f} ──\n' + stripped)

js_bundle = '\n\n'.join(js_parts)

html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Handpan Chords</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
{css}
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
{js_bundle}
  </script>
</body>
</html>'''

out = os.path.join(ROOT, 'index.html')
with open(out, 'w') as f:
    f.write(html)

print(f'Built {out} ({len(html)//1024}KB)')
