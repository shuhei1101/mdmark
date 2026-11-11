# NG の単語の件数を数える。引数: 対応表の YAML・数える範囲のフォルダ・結果の JSON の出力先
import sys, re, os, json, collections, pathlib, yaml
wl = yaml.safe_load(open(sys.argv[1], encoding='utf-8'))
root = pathlib.Path(sys.argv[2])
rules = []
for e in wl['entries']:
    pat = re.compile(e['pattern']) if e.get('pattern') else re.compile(re.escape(e['ng']))
    rules.append((e['id'], e['ng'], pat, e.get('allow') or []))
ext = {'.md','.html','.yaml','.yml','.ts','.tsx','.js','.mjs','.css','.json','.txt'}
skip = {'.git','node_modules','dist','tmp','coverage','.claude'}
by_word = collections.Counter(); files = collections.Counter(); by_top = collections.Counter(); names = []
for dp, dn, fn in os.walk(root):
    dn[:] = [d for d in dn if d not in skip]
    rel = pathlib.Path(dp).relative_to(root)
    if str(rel).startswith('dev/pr'): dn[:] = []; continue
    for f in fn:
        p = pathlib.Path(dp) / f
        r = str(p.relative_to(root))
        def hits(t):
            out = []
            for i, ng, pat, allow in rules:
                for m in pat.finditer(t):
                    s = m.start()
                    ok = any(t.startswith(a, k) for a in allow for k in range(max(0, s-len(a)+1), s+1))
                    if not ok: out.append(ng)
            return out
        nh = hits(p.stem.split('.')[0])
        if nh: names.append((r, sorted(set(nh))))
        if p.suffix not in ext: continue
        try: t = p.read_text(encoding='utf-8')
        except Exception: continue
        h = hits(t)
        if h:
            files[r] = len(h); by_word.update(h); by_top[r.split('/')[0] if '/' in r else r] += len(h)
print(json.dumps({'hits': sum(files.values()), 'files': len(files), 'by_top': by_top.most_common(), 'by_word': by_word.most_common()}, ensure_ascii=False))
json.dump({'files': files, 'names': names}, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
