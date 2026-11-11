"""セットアップのファイルへの書き込みの「記載」を「書き込む」の活用にする（記載方法・手での記載・利用者への記載の指示は残す）。"""
import re, sys, pathlib
sys.path.insert(0, '/tmp/mdmark-289-scripts')
from fixwrite import FORM, MAP
for f in sys.argv[1:]:
    p = pathlib.Path(f); t = p.read_text(encoding='utf-8')
    def rep(m):
        s, e = m.start(), m.end()
        if t.startswith('記載方法', s) or t[max(0, s - 2):s] == '手で' or re.match(r'(してください|しようと|してから)', t[s + 2:]) and t[max(0,s-1):s] == 'で':
            return m.group(0)
        out = MAP[m.group(0)]
        # 書き込もうとした
        return out
    n = FORM.sub(rep, t).replace('書き込みしようとした', '書き込もうとした').replace('書き込みようとした', '書き込もうとした')
    if n != t:
        for a, b in zip(t.split('\n'), n.split('\n')):
            if a != b: print(f.split('/')[-1], '|', b.strip()[:150])
        p.write_text(n, encoding='utf-8')
