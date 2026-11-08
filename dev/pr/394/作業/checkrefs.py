import re, subprocess, pathlib, yaml, urllib.parse
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
files=[f for f in subprocess.run(['git','ls-files'],capture_output=True,text=True).stdout.split('\n') if f and not f.startswith(('dev/pr/','dev/mock/refs/','docs/_theme/'))]
# anchors
bad_a=0
for f in files:
    if not f.endswith('.md'): continue
    p=pathlib.Path(f); t=p.read_text(encoding='utf-8')
    for m in re.finditer(r'\]\(([^()\s#]*)#([^()\s]+)\)',t):
        url,frag=m.group(1),urllib.parse.unquote(m.group(2))
        if url.startswith(('http','mailto:')): continue
        tp=p if url=='' else p.parent/urllib.parse.unquote(url)
        if not tp.exists() or tp.suffix!='.md': continue
        if frag not in headings(tp.read_text(encoding='utf-8')): bad_a+=1
# design refs
cache={}
def names(did,sec):
    if did not in cache:
        fp=pathlib.Path(did+'.yaml')
        cache[did]=yaml.safe_load(fp.read_text(encoding='utf-8')) if fp.exists() else None
    d=cache[did]
    if d is None: return None
    v=d.get(sec) if isinstance(d,dict) else None
    return {x.get('name') for x in v if isinstance(x,dict)} if isinstance(v,list) else set()
bad_r=0
for f in files:
    if not f.endswith(('.yaml','.md','.ts')): continue
    try: t=pathlib.Path(f).read_text(encoding='utf-8')
    except Exception: continue
    for m in re.finditer(r'(dev/設計書/[^\s#\'"`、。（）]+)#(\w+)\[([^\]\n]+)\]',t):
        n=names(m.group(1),m.group(2))
        if n is None or m.group(3) not in n: bad_r+=1
print('anchors_missing',bad_a,'design_refs_missing',bad_r)
