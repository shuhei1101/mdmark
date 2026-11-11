import re,sys,subprocess,pathlib
rows=[l.rstrip('\n').split('\t') for l in open(sys.argv[1],encoding='utf-8') if l.strip()]
stems={}
for o,n in rows:
    ob,nb=o.split('/')[-1],n.split('/')[-1]
    os_,ns_=ob.split('.')[0],nb.split('.')[0]
    if os_!=ns_: stems[os_]=ns_
folders=[('ClaudeCodeで使う','ClaudeCodeで使用する'),('VSCodeで見る','VSCodeで確認する'),('書く','記載する'),('使い方','使用方法')]
stem_re=re.compile('(' + '|'.join(re.escape(s) for s in sorted(stems,key=len,reverse=True)) + r')(?=[./#])')
files=subprocess.run(['git','ls-files'],capture_output=True,text=True).stdout.split('\n')
skip=('dev/pr/','dev/mock/refs/','docs/_theme/','node_modules','dist/','package-lock.json')
changed=0
for f in files:
    if not f or f.startswith(skip): continue
    p=pathlib.Path(f)
    if p.suffix not in ('.md','.yaml','.yml','.ts','.tsx','.js','.mjs','.json','.html','.css','.txt'): continue
    try: t=p.read_text(encoding='utf-8')
    except Exception: continue
    s=stem_re.sub(lambda m: stems[m.group(1)], t)
    # folders: docs/ paths
    for o,n in folders:
        s=s.replace('docs/使い方/'+o+'/','docs/使用方法/'+n+'/') if o!='使い方' else s
    s=s.replace('docs/使い方','docs/使用方法')
    if f.startswith('docs/') or f.startswith('guide/'):
        for o,n in folders:
            s=re.sub(r'(?<=[(\s/"\'`])'+re.escape(o)+r'/', n+'/', s) if o!='使い方' else s
        s=re.sub(r'(?<=[(\s"\'`])(\.\./|\./)?使い方/', lambda m:(m.group(1) or '')+'使用方法/', s)
        s=re.sub(r'(?<=/)使い方/', '使用方法/', s)
    if s!=t: p.write_text(s,encoding='utf-8'); changed+=1
print('changed',changed)
