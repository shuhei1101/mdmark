"""E2E のテストの文字列リテラルのうち、テストの名前と、製品側で変えた文言を期待値に持つ行だけに reword を当てる。

fixture の入力（製品側に無い文字列）は変えない。判定の結果を標準出力に書き込む。
"""
import os, re, sys, pathlib
sys.path.insert(0, '/tmp/mdmark-289-scripts')
import reword as r

JA = re.compile(r'[぀-ヿ一-鿿]')
# リテラルの直前がテストの名前の引数か
TITLE = re.compile(r'\b(test|it|describe)(\.(describe|step|skip|only|fixme))*\(\s*$')


def corpus(root, subs):
    """root の下の subs のテキストファイルを 1 つの文字列にする（plugin/scripts の生成物を除く）。"""
    parts = []
    for dp, _, fs in (w for sub in subs for w in os.walk(os.path.join(root, sub))):
        if '/plugin/scripts' in dp:
            continue
        for f in fs:
            try:
                parts.append(pathlib.Path(dp, f).read_text(encoding='utf-8'))
            except Exception:
                pass
    return '\n\0'.join(parts)


CODE = ['src', 'vscode', 'plugin', 'templates', 'schemas', 'scripts']
DOCS = ['docs', 'guide']
BASE = corpus('/tmp/e2e-lit/base', CODE)
CUR = corpus('/tmp/e2e-lit/cur', CODE)
BASE_DOCS = corpus('/tmp/e2e-lit/base', DOCS)
APPLY = '--apply' in sys.argv
report = []


def decide(src, start, seg):
    """リテラルの中身 seg を、テストの名前・製品で変えた文言なら置き換え、それ以外は残す。"""
    if not JA.search(seg):
        return seg
    # テストの名前: 全て置き換える
    if TITLE.search(src[max(0, start - 80):start - 1]):
        new = '\n'.join(r.reword_line(x) for x in seg.split('\n'))
        if new != seg:
            report.append(('title', seg, new))
        return new
    out = []
    for line in seg.split('\n'):
        new = r.reword_line(line)
        key = line.strip()
        # 変わらない行はそのまま
        if new == line:
            out.append(line)
        # base の製品側にあり今の製品側に無い文言: 製品の文言を期待値に持つため置き換える
        elif len(key) >= 2 and key in BASE and key not in CUR:
            report.append(('product' if new.strip() in CUR else 'product?', line, new)); out.append(new)
        # base の公開ドキュメントにある文言: テストが文書を読み込むかを手で確かめる
        elif len(key) >= 2 and key in BASE_DOCS:
            report.append(('docs', line, new)); out.append(line)
        # それ以外は fixture の入力として残す
        else:
            report.append(('keep', line, new)); out.append(line)
    return '\n'.join(out)


def transform(src):
    """コメントの外の文字列リテラル（テンプレートは ${} の外）に decide を当てる。"""
    out = []; i = 0; n = len(src); stack = []

    def lit(q, i):
        j = i
        while j < n:
            c = src[j]
            if c == '\\':
                j += 2; continue
            if c == q:
                return j, 'end'
            if q == '`' and src.startswith('${', j):
                return j, 'expr'
            if q != '`' and c == '\n':
                return j, 'end'
            j += 1
        return n, 'end'

    def string_from(q, i):
        j, kind = lit(q, i)
        out.append(decide(src, i, src[i:j]))
        if kind == 'expr':
            out.append('${'); stack.append(0); return j + 2
        out.append(src[j:j + 1]); return j + 1

    while i < n:
        c = src[i]
        if stack and c == '}' and stack[-1] == 0:
            stack.pop(); out.append(c); i = string_from('`', i + 1); continue
        if stack and c == '{':
            stack[-1] += 1
        elif stack and c == '}':
            stack[-1] -= 1
        if src.startswith('//', i) and not src.startswith('://', i - 1):
            j = src.find('\n', i); j = n if j < 0 else j
            out.append(src[i:j]); i = j; continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2); j = n if j < 0 else j + 2
            out.append(src[i:j]); i = j; continue
        if c in '\'"`':
            out.append(c); i = string_from(c, i + 1); continue
        out.append(c); i += 1
    return ''.join(out)


if __name__ == '__main__':
    for f in [a for a in sys.argv[1:] if not a.startswith('--')]:
        report.clear()
        p = pathlib.Path(f); s = p.read_text(encoding='utf-8'); d = transform(s)
        for kind, a, b in report:
            print(f'{kind}\t{p.name}\t{a.strip()[:150]}\t{b.strip()[:150]}')
        if APPLY and d != s:
            p.write_text(d, encoding='utf-8')
