"""見出しのアンカーと設計書の項目名の参照を付け替える。引数: renames.tsv base の ref"""
import re, sys, subprocess, pathlib, yaml, urllib.parse
rows = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
BASE = sys.argv[2]
new2old = {n: o for o, n in rows}
def base_text(path):
    old = new2old.get(path, path)
    r = subprocess.run(['git', 'show', f'{BASE}:{old}'], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None
def slug(t):
    t = re.sub(r'<[^>]+>', '', t).strip().lower()
    t = re.sub(r'[^\w\- ]', '', t)
    return t.replace(' ', '-')
def headings(text):
    out, fence = [], False
    for l in text.split('\n'):
        if l.startswith('```'): fence = not fence; continue
        if fence: continue
        m = re.match(r'(#{1,6})\s+(.*)', l)
        if m: out.append(slug(m.group(2)))
    return out
# 1. アンカー
md_files = [f for f in subprocess.run(['git', 'ls-files', '*.md'], capture_output=True, text=True).stdout.split('\n')
            if f and not f.startswith(('dev/pr/', 'dev/mock/refs/', 'docs/_theme/'))]
amap = {}
for f in md_files:
    bt = base_text(f)
    if bt is None: continue
    ob, nb = headings(bt), headings(pathlib.Path(f).read_text(encoding='utf-8'))
    if len(ob) == len(nb):
        amap[f] = {o: n for o, n in zip(ob, nb) if o != n}
fixed = 0
for f in md_files:
    p = pathlib.Path(f); t = p.read_text(encoding='utf-8')
    def fix(m):
        global fixed
        url, frag = m.group(1), m.group(2)
        if url.startswith(('http', 'mailto:')): return m.group(0)
        target = f if url == '' else str((p.parent / urllib.parse.unquote(url)).resolve().relative_to(pathlib.Path.cwd().resolve())) if (p.parent / urllib.parse.unquote(url)).exists() else None
        if target is None or target not in amap: return m.group(0)
        tf = urllib.parse.unquote(frag)
        if tf in amap[target]:
            fixed += 1
            return f'({url}#{amap[target][tf]})'
        return m.group(0)
    s = re.sub(r'\(([^()\s#]*)#([^()\s]+)\)', fix, t)
    if s != t: p.write_text(s, encoding='utf-8')
print('anchors fixed', fixed)
# 2. 設計書の項目名
ymls = [f for f in subprocess.run(['git', 'ls-files', 'dev/設計書/*.yaml', 'dev/設計書/**/*.yaml'], capture_output=True, text=True).stdout.split('\n') if f]
pairs = []
for f in ymls:
    bt = base_text(f)
    if not bt: continue
    try:
        bo, no = yaml.safe_load(bt), yaml.safe_load(pathlib.Path(f).read_text(encoding='utf-8'))
    except Exception:
        continue
    if not isinstance(bo, dict) or not isinstance(no, dict): continue
    did = f[:-5]
    for sec, bv in bo.items():
        nv = no.get(sec)
        if isinstance(bv, list) and isinstance(nv, list) and len(bv) == len(nv):
            for a, b in zip(bv, nv):
                if not (isinstance(a, dict) and isinstance(b, dict)): continue
                for key in ('name', 'item', 'title'):
                    if isinstance(a.get(key), str) and isinstance(b.get(key), str) and a[key] != b[key]:
                        pairs.append((f'{did}#{sec}[{a[key]}]', f'{did}#{sec}[{b[key]}]'))
pairs.sort(key=lambda x: -len(x[0]))
files = [f for f in subprocess.run(['git', 'ls-files'], capture_output=True, text=True).stdout.split('\n')
         if f and not f.startswith(('dev/pr/', 'dev/mock/refs/', 'docs/_theme/')) and f.endswith(('.yaml', '.yml', '.md', '.ts'))]
cnt = 0
for f in files:
    p = pathlib.Path(f)
    try: t = p.read_text(encoding='utf-8')
    except Exception: continue
    s = t
    for a, b in pairs:
        if a in s: cnt += s.count(a); s = s.replace(a, b)
    if s != t: p.write_text(s, encoding='utf-8')
print('item refs fixed', cnt)
