"""JS/TS のコメントと文字列リテラルの中の日本語だけに reword を当てる。"""
import sys, re, pathlib
sys.path.insert(0, '/tmp/mdmark-289-scripts')
import reword as r

# 真なら JSX のテキストだけを置き換える（リテラルとコメントを置き換え済みのファイルに当てるとき）
ONLY_PLAIN = '--only-plain' in sys.argv
# 真ならコメントだけを置き換える（文字の位置や並びを確かめるテストの入力を変えないとき）
ONLY_COMMENTS = '--only-comments' in sys.argv
JA = re.compile(r'[぀-ヿ一-鿿]')


def fix(text):
    """日本語を含む断片だけを行ごとに置き換える。"""
    if not JA.search(text):
        return text
    return '\n'.join(r.reword_line(ln) for ln in text.split('\n'))


def transform(src):
    """コメントと文字列リテラル（テンプレートは ${} の外側）にだけ fix を当てる。"""
    out = []; i = 0; n = len(src)
    # リテラルとコメントの外の文字（JSX のテキストを含む）。日本語は JSX のテキストにしか出ない
    plain = []

    def flush():
        if plain:
            out.append(''.join(plain) if ONLY_COMMENTS else fix(''.join(plain))); plain.clear()
    # テンプレートリテラルの ${ の中の波括弧の深さ（入れ子ごとに積む）
    stack = []

    def lit(q, i):
        """i から閉じの引用符（テンプレートは ${ も）の位置と、止まった理由を返す。"""
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
        """開きの引用符の次の i から文字列を読み、出力に積んで次の位置を返す。"""
        j, kind = lit(q, i)
        out.append(src[i:j] if ONLY_PLAIN or ONLY_COMMENTS else fix(src[i:j]))
        if kind == 'expr':
            out.append('${'); stack.append(0); return j + 2
        out.append(src[j:j + 1]); return j + 1

    while i < n:
        c = src[i]
        # ${ の式が閉じた: テンプレートリテラルの続きを読む
        if stack and c == '}' and stack[-1] == 0:
            flush(); stack.pop(); out.append(c); i = string_from('`', i + 1); continue
        if stack and c == '{':
            stack[-1] += 1
        elif stack and c == '}':
            stack[-1] -= 1
        if src.startswith('//', i) and not src.startswith('://', i - 1):
            flush(); j = src.find('\n', i); j = n if j < 0 else j
            out.append(src[i:j] if ONLY_PLAIN else fix(src[i:j])); i = j; continue
        if src.startswith('/*', i):
            flush(); j = src.find('*/', i + 2); j = n if j < 0 else j + 2
            out.append(src[i:j] if ONLY_PLAIN else fix(src[i:j])); i = j; continue
        if c in '\'"`':
            flush(); out.append(c); i = string_from(c, i + 1); continue
        plain.append(c); i += 1
    flush()
    return ''.join(out)


if __name__ == '__main__':
    dry = '--dry' in sys.argv
    for f in [a for a in sys.argv[1:] if not a.startswith('--')]:
        p = pathlib.Path(f); s = p.read_text(encoding='utf-8'); d = transform(s)
        if d != s:
            if not dry:
                p.write_text(d, encoding='utf-8')
            print(sum(1 for a, b in zip(s.split('\n'), d.split('\n')) if a != b), f)
