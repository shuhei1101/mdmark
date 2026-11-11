"""出力先（クリップボード・標準出力・ファイルなど）への「記載」を「書き込む」の活用に直す。"""
import re, sys, pathlib

CTX = re.compile(r'dist/|fixtures/|plugin/` に|LICENSES_FILE|writeText|クリップボード|settings\.json|標準エラー|stderr|標準出力|stdout|env に|`env`|ログに|書き出し先|MDMARK_CONFIG')
# 記載の活用と、書き込むの活用の対応（長い順に照合する）
FORMS = [
    ('記載できなければ', '書き込めなければ'), ('記載できなかった', '書き込めなかった'), ('記載できない', '書き込めない'),
    ('記載できた', '書き込めた'), ('記載できる', '書き込める'), ('記載できず', '書き込めず'),
    ('記載されて', '書き込まれて'), ('記載され', '書き込まれ'), ('記載しない', '書き込まない'), ('記載して', '書き込んで'),
    ('記載した', '書き込んだ'), ('記載し', '書き込み'), ('記載する', '書き込む'), ('記載', '書き込み'),
]
FORM = re.compile('|'.join(re.escape(a) for a, _ in FORMS))
MAP = dict(FORMS)
# 人が文書・入力に書いた意味の「記載」は残す
KEEP_BEFORE = re.compile(r'(Markdown に|文書に|コードブロックに|本文に|`data-[a-z-]+` に|定義に|表に)$')
KEEP_AFTER = re.compile(r'^(方法|の警告)|^した(文字|罫線|先頭|順|計算|列|行|値|内容)')


def fix_line(line):
    """出力先の語の後ろの同じ文と、続く「記載でき」の文の記載を直す。"""
    out = []; pos = 0; active_until = -1
    for m in FORM.finditer(line):
        s = m.start()
        head = line[:s]
        # 直前の出力先の語が同じ文の中にあるか
        last_ctx = max((c.end() for c in CTX.finditer(head)), default=-1)
        sentence_start = max(head.rfind('。'), head.rfind('\n'))
        in_ctx = last_ctx > sentence_start
        follow = s <= active_until and m.group(0).startswith('記載でき')
        if not (in_ctx or follow) or KEEP_BEFORE.search(head) or KEEP_AFTER.match(line[s + 2:]):
            continue
        out.append(line[pos:s]); out.append(MAP[m.group(0)]); pos = m.end()
        # この文の次の文の頭までは「記載でき」を続けて直す
        nxt = line.find('。', m.end()); nxt2 = line.find('。', nxt + 1) if nxt >= 0 else -1
        active_until = nxt2 if nxt2 >= 0 else len(line)
    out.append(line[pos:])
    return ''.join(out)


if __name__ == '__main__':
    dry = '--dry' in sys.argv
    for f in [a for a in sys.argv[1:] if a != '--dry']:
        p = pathlib.Path(f)
        try:
            s = p.read_text(encoding='utf-8')
        except Exception:
            continue
        d = '\n'.join(fix_line(ln) for ln in s.split('\n'))
        if d != s:
            for a, b in zip(s.split('\n'), d.split('\n')):
                if a != b and dry:
                    print(f.split('/')[-1], '|', b.strip()[:200])
            if not dry:
                p.write_text(d, encoding='utf-8')
