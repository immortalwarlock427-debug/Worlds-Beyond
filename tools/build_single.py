"""Builds dist/worlds-beyond-sheet.html: the site as one file, with the stylesheet and scripts inlined.

The website itself needs no build step (GitHub Pages serves the files as they are). This single file is only for
places that want one page, like the Claude artifact the sheet started in. The map pictures stay separate files and
are referenced as maps/..., so publish them next to it.

Usage: python3 tools/build_single.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')


def inline_css(m):
    css = (ROOT / m.group(1)).read_text(encoding='utf-8')
    return '<style>\n' + css + '</style>'


def inline_js(m):
    js = (ROOT / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + js.replace('</script', '<\\/script') + '</script>'


html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)
for tag in ('link rel="stylesheet" href="css/', 'script src="js/'):
    assert tag not in html, 'something was not inlined: ' + tag

out = ROOT / 'dist' / 'worlds-beyond-sheet.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print('wrote', out.relative_to(ROOT), len(html), 'bytes')
