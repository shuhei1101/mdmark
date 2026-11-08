import subprocess,pathlib
p=pathlib.Path('docs/リファレンス/用語集.md')
new=p.read_text(encoding='utf-8').split('\n')
base=subprocess.run(['git','show','7a9367dd:docs/リファレンス/用語集.md'],capture_output=True,text=True).stdout.split('\n')
assert len(new)==len(base)
out=[]
for nl,bl in zip(new,base):
    if nl.startswith('| ') and bl.startswith('| ') and not nl.startswith('| ---') and not nl.startswith('| 用語 |'):
        nc=nl.split(' | '); bc=bl.split(' | ')
        if len(nc)>=4 and len(bc)>=4:
            nterm=nc[0][2:]; bterm=bc[0][2:]
            aliases=[a for a in bc[1].split('・') if a]
            if nterm!=bterm and bterm not in aliases: aliases.insert(0,bterm)
            nc[1]='・'.join(aliases); nl=' | '.join(nc)
    out.append(nl)
p.write_text('\n'.join(out),encoding='utf-8')
