"""NG の単語を置き換える。引数: ファイル...（--dry で差分の件数だけ出す）"""
import re, sys, pathlib

K = '[㐀-鿿々]'
NK = f'(?<!{K})'

# 1. 言い回し（先に当てる。長いものから）
PHRASES = [
    # 用語・主語の呼び名
    ('使う側', '利用側'),
    ('文書を書く人', '文書の作成者'),
    ('文書を読む人', '閲覧者'),
    ('読む人', '閲覧者'),
    ('書く人', '作成者'),
    ('書き手', '作成者'),
    ('知らせの枠', '通知の枠'),
    ('書き方の警告', '記載の警告'),
    ('読み書きする', '読み込みと保存をする'),
    ('コメントの読み書きの関数', 'コメントの読み込みと保存の関数'),
    ('読み書きの関数', '読み込みと保存の関数'),
    ('読み書き', '読み込みと保存'),
    ('範囲の印', '範囲のマーカー'),
    ('コメントの印', 'コメントのマーカー'),
    ('コードの行の印', 'コードの行のマーカー'),
    ('閉じの印', '閉じのマーカー'),
    ('印の場所', 'マーカーの場所'),
    ('手元の版', '手元のバージョン'),
    ('使い方集', 'ガイド'),
    ('使い方', '使用方法'),
    ('書き方', '記載方法'),
    ('呼び直し方', 'もう一度呼ぶ方法'), ('直し方', '修正方法'),
    ('書き忘れ', '記載漏れ'),
    ('効かせ', '有効にし'), ('キャプチャの段', 'キャプチャーフェーズ'), ('上の段', '上の行'), ('段の入れ子', '階層の入れ子'),
    ('罫線から段', '罫線から階層'), ('書き写し', '複製し'), ('並びに直る', '並びに変換される'), ('{段}', '{行}'),
    ('あれば通す', 'あれば合格にする'), ('点検を通す', '点検に合格させる'),
    ('の版以下', 'のバージョン以下'), ('の版以上', 'のバージョン以上'),
    ('書き戻す', '書き込んで戻す'), ('書き戻し', '書き込んで戻し'), ('書き誤り', '誤記'),
    ('置く先', '配置先'), ('書けないパス', '書き込めないパス'), ('ファイルを書け', 'ファイルを書き込め'),
    ('送り先', 'スクロール先'), ('文字に引く', '文字に付ける'), ('から見た', 'を基準にした'),
    ('検査を通す', '検査にかける'), ('検査を通し', '検査にかけ'), ('検査を通さ', '検査にかけ'),
    ('点検を通し', '点検に合格し'), ('確かめ方', '確認方法'), ('知らせ方', '通知方法'),
    ('結合のし直し', '再結合'), ('拡大中は送らず', '拡大中は切り替えず'), ('端では送らない', '端では切り替えない'),
    ('渡し方', '指定方法'), ('置き方', '配置方法'), ('返し方', '返却方法'), ('送り方', '送信方法'),
    ('外し方', '除外方法'), ('消し方', '削除方法'), ('足し方', '追加方法'),
    ('に読み替える', 'として解釈する'), ('に読み替えて', 'として解釈して'), ('に読み替えた', 'として解釈した'),
    ('に読み替え', 'として解釈し'), ('読み替える', '解釈する'), ('読み替え', '解釈し'),
    ('に読み分ける', 'として判別する'), ('読み分け', '判別し'),
    ('付け外しする', '付与・解除する'), ('付け外し', '付与・解除'),
    ('当たりの範囲', 'クリックを受ける範囲'), ('文書の通し', '文書全体'),
    ('列の揃え', '列の配置'), ('軸で読む', '軸で示す'), ('書き終え', '書き込み終え'), ('書きかけ', '書き込みかけ'), ('何も書かず', '何も書き込まず'), ('何も書かない', '何も書き込まない'),
    ('ポインターの形', 'ポインターの形状'), ('アイコンの形', 'アイコンの形状'), ('カーソルの形', 'カーソルの形状'),
    ('線の形', '線の形状'), ('矢印の形', '矢印の形状'), ('直し忘れ', '修正漏れ'),
    ('書き出し直す', 'もう一度書き出す'), ('書き出し直し', 'もう一度書き出し'), ('書き出し直さ', 'もう一度書き出さ'),
    ('つなぎ直す', 'もう一度つなぐ'), ('つなぎ直し', 'もう一度つなぎ'), ('つなぎ直さ', 'もう一度つなが'),
    ('やり直す', 'もう一度実行する'), ('やり直し', 'もう一度実行し'),
    ('置き場所', '配置場所'),
    ('読み上げの名前', 'アクセシブルネーム'), ('読み上げ名', 'アクセシブルネーム'),
    ('読み上げだけの', 'スクリーンリーダー向けの'), ('読み上げの要素', 'スクリーンリーダー向けの要素'),
    ('読み上げる', 'スクリーンリーダーに伝える'), ('読み上げて', 'スクリーンリーダーに伝えて'),
    ('読み上げた', 'スクリーンリーダーに伝えた'), ('読み上げられ', 'スクリーンリーダーに伝えられ'),
    ('読み上げ', 'スクリーンリーダー'),
    ('送り主', '送信者'), ('画像の送り', '画像の切り替え'), ('送り・拡大', '切り替え・拡大'),
    ('前後に送る', '前後に切り替える'), ('前後へ送る', '前後へ切り替える'), ('前後に送り', '前後に切り替え'),
    ('前後へ送り', '前後へ切り替え'), ('前後に送っ', '前後に切り替え'), ('送りのボタン', '切り替えのボタン'),
    ('送りの並び', '切り替えの並び'), ('送りと閉じる', '切り替えと閉じる'),
    ('描画の口', '描画のインターフェース'), ('捕捉の段', 'キャプチャーフェーズ'),

    ('読み飛ばした', 'スキップした'), ('読み飛ばして', 'スキップして'), ('読み飛ばす', 'スキップする'),
    ('読み飛ばし', 'スキップし'), ('読み飛ばさ', 'スキップし'),
    ('折り返し直した', 'もう一度折り返した'), ('折り返し直す', 'もう一度折り返す'), ('折り返し直し', 'もう一度折り返し'),
    ('送りに合わせ', 'スクロールに合わせ'), ('選びを外す', '選択を解除する'), ('選びを外し', '選択を解除し'), ('選びを外さ', '選択を解除し'),
    ('外れる', '除外される'), ('外れた', '除外された'), ('外れて', '除外されて'), ('外れ', '除外され'),
    ('線を引いて描く', '線を描く'),
    ('左に寄せ', '左に詰め'), ('右に寄せ', '右に詰め'),
    ('下線を引いて', '下線を付けて'), ('下線を引いた', '下線を付けた'), ('下線を引く', '下線を付ける'),
    ('下線を引き', '下線を付け'), ('下線を引か', '下線を付け'),
    ('線を引', '線を描'),
    ('変更を見る', '変更を表示'),
    ('見た目', '外観'),
    ('することができ', 'でき'),
    ('することが出来', 'でき'),
    ('正本', '原本'),
    ('出どころ', '出典'),
    ('確度', '確信度'),
]
# 「見た目」は対応表の見る（見(?:る|た|て…)）に当たるため置き換える

# 2. 動詞の活用（語幹 → 置き換え先の語幹の作り）
# 五段: (NG の語幹の字, 未然形の字, 新しい語) 新しい語は「する」動詞の語幹
GODAN = {
    '読': ('ま', 'み', 'む', 'め', 'も', 'ん', None),   # 読む → 読み込む（五段のまま）
    '書': ('か', 'き', 'く', 'け', 'こ', 'い', '記載'),
    '使': ('わ', 'い', 'う', 'え', 'お', 'っ', '使用'),
    '置': ('か', 'き', 'く', 'け', 'こ', 'い', '配置'),
    '返': ('さ', 'し', 'す', 'せ', 'そ', 'し', '返却'),
    '渡': ('さ', 'し', 'す', 'せ', 'そ', 'し', '指定'),
    '直': ('さ', 'し', 'す', 'せ', 'そ', 'し', '修正'),
    '外': ('さ', 'し', 'す', 'せ', 'そ', 'し', '除外'),
    '足': ('さ', 'し', 'す', 'せ', 'そ', 'し', '追加'),
    '消': ('さ', 'し', 'す', 'せ', 'そ', 'し', '削除'),
    '送': ('ら', 'り', 'る', 'れ', 'ろ', 'っ', '送信'),
    '流': ('さ', 'し', 'す', 'せ', 'そ', 'し', '実行'),
    '引': ('か', 'き', 'く', 'け', 'こ', 'い', '参照'),
    '積': ('ま', 'み', 'む', 'め', 'も', 'ん', '追加'),
    '拾': ('わ', 'い', 'う', 'え', 'お', 'っ', '取得'),
    '通': ('さ', 'し', 'す', 'せ', 'そ', 'し', '経由'),
    '起こ': ('さ', 'し', 'す', 'せ', 'そ', 'し', '作成'),
    '推': ('さ', 'し', 'す', 'せ', 'そ', 'し', '推奨'),
    '当た': ('ら', 'り', 'る', 'れ', 'ろ', 'っ', '該当'),
    '効': ('か', 'き', 'く', 'け', 'こ', 'い', None),  # 効く → 有効になる（別に扱う）
    '描き直': ('さ', 'し', 'す', 'せ', 'そ', 'し', '再描画'),
    '書き足': ('さ', 'し', 'す', 'せ', 'そ', 'し', '追記'),
}
ALLOW = ['書き込', '書き出', '書き換', '書き直', '読み込', '読み取', '置き換', '繰り返', '割り当て',
         '引き渡', '問い合わせ', 'お知らせ', '書き写し', '書き起こ', '引き起こ', '掘り起こ', '呼び起こ',
         '思い起こ', '折り返', '使い回', '受け渡', '取り消', '積み上げ', '積み重', '控えめ', '当たり前', '突き当た', '行き当た', '差し当た', '思い当た', 'つ当たり', 'り当たり',
         '組み立て', '役立て', '語り合', '通し番号']
# 一段: NG の語幹 → 新しい「する」動詞の語幹
ICHIDAN = {
    '確かめ': '確認', '当て': '適用', '避け': '回避', '控え': '記録', '載せ': '記載',
    '寄せ': '統一', '立て': '起動', '答え': '回答', '知らせ': '通知', '揃え': '統一', '束ね': None,
}

def suru(new, tail):
    """「する」動詞の活用を返す。tail は元の活用語尾以降の文字列の先頭"""
    return new

CONTEXT = [
    (r'(?:\.(?:html|css|js|json|yaml|md|vsix|log|txt)`?|[\w.]/`?|ファイル|フォルダ|HTML|CSS|標準エラー|標準出力|ログ|ディスク|一時ファイル|出力先|書き出す先|コピー先|保存先|雛形|チャネル|クリップボード|配布物)\s*(?:を|に|へ)\s*', '書', '書き込'),
    (r'(?:印|マーカー)\s*を\s*', '外', '削除'),
    (r'索引\s*を\s*', '書', '書き込'),
    (r'(?:(?:位置|中ほど|末尾|先頭|ミニマップ|差分|下端|上端)\s*(?:へ|に|で|を|まで)|見えるまで)\s*', '送', 'スクロール'),
    (r'(?:ガイド|使い方集|規約|手順|説明|』)\s*(?:を|の)\s*', '読', '参照'),
]
ROWS = {'き': 'かきくけこい', 'み': 'まみむめもん', 'し': 'さしすせそし', 'い': 'わいうえおっ', 'り': 'らりるれろっ',
        'び': 'ばびぶべぼん', 'ぎ': 'がぎぐげごい', 'ち': 'たちつてとっ'}

def conj_okosu(m):
    form, rest = m.group('form'), m.group('rest')
    if form == 'す':
        return '発生させる' + rest
    if form == 'さ':
        return '発生させ' + rest[1:] if rest.startswith('せ') else '発生させ' + rest
    if form == 'せ':
        return '発生させられ' + rest[1:] if rest.startswith('る') or rest.startswith('な') else '発生させ' + rest
    return '発生させ' + rest

def conj_naosu(m):
    v, i, form, rest = m.group('v'), m.group('i'), m.group('form'), m.group('rest')
    if v.endswith('書') and i == 'き':
        return m.group(0)
    for tail, ii, new in [('描', 'き', '再描画'), ('読み込', 'み', '再読み込み'), ('読', 'み', '再読み込み'), ('作', 'り', '再作成')]:
        if v.endswith(tail) and i == ii:
            after = m.string[m.end():m.end() + 1]
            if form == 'し' and (rest == '' and after in 'はのをがも）」' or rest[:1] != '' and rest[:1] in 'はのをがも'):
                return v[:-len(tail)] + new + rest
            return v[:-len(tail)] + conj_godan_new(new, form, rest, 'さしすせそし')
    idx = 'さしすせそ'.index(form)
    if rest.startswith(('た', 'て')) and form == 'し':
        idx = 5
    after = m.string[m.end():m.end() + 1]
    if form == 'し' and (rest == '' and after in '）」・はのをがも' or rest[:1] != '' and rest[:1] in 'はのをがも'):
        key = v[-1] + i if i != 'し' or re.search('[ぁ-ん]', v) or len(v) < 2 else v + i
        for k, noun in [('当て', '再適用'), ('入れ', '再インストール'), ('置き', '再配置'), ('付け', '再付与'), ('振り', '再割り当て'), ('並べ', '並べ替え'),
                        ('選び', '再選択'), ('呼び', '再呼び出し'), ('開き', '再表示'), ('決め', '再決定'), ('閉じ', '再度の閉じ')]:
            if key.endswith(k):
                return v[:-1] + noun + rest if len(v) > 1 and not v.startswith('読み') else noun + rest
        if i == 'し' and len(v) >= 2 and not re.search('[ぁ-ん]', v):
            return '再' + v + rest
    if i == 'し' and len(v) >= 2 and not re.search('[ぁ-ん]', v):      # 漢語 + し直す → もう一度 漢語する
        return 'もう一度' + v + suru_form(idx, rest)
    if v == '同' or v.endswith('同'):
        return m.group(0)
    pre = ''
    if not v.startswith('読み') and len(v) > 1 and not re.search('[ぁ-ん]', v):
        pre, v = v[:-1], v[-1]
    if i in ROWS:
        row = ROWS[i]
        out = row[idx]
        if idx == 5 and i in 'びぎ' and rest[:1] in 'たて':
            rest = {'た': 'だ', 'て': 'で'}[rest[0]] + rest[1:]
        return pre + 'もう一度' + reword_segment(v + out + rest)
    # 一段（め・け・じ・え・せ・て）
    ichi = ['', '', 'る', 'れ', 'よ', ''][idx]
    if idx == 3 and not rest.startswith('ば'):
        ichi = 'られ'
    return pre + 'もう一度' + reword_segment(v + i + ichi + rest)

def suru_form(idx, rest):
    if idx == 0:
        return ('さ' if rest.startswith(('れ', 'せ')) else 'せ' if rest.startswith('ず') else 'し') + rest
    if idx in (1, 5):
        return 'し' + rest
    if idx == 2:
        return 'する' + rest
    if idx == 3:
        return ('すれ' if rest.startswith('ば') else 'でき') + rest
    return 'しよ' + rest

def conj_godan_new(new, form, rest, row):
    idx = row.index(form) if form in row[:5] else 5
    if form == row[1] and rest.startswith(('た', 'て')):
        idx = 5
    return new + suru_form(idx, rest)

def conj_godan(m, override=None):
    stem, form, rest = m.group('stem'), m.group('form'), m.group('rest') or ''
    a, i, u, e, o, te, new = GODAN[stem]
    if override is not None:
        if override.endswith('込'):
            row = [a, i, u, e, o, te]
            idx = row.index(form)
            if form == i and rest.startswith(('た', 'て')):
                idx = 5
            if idx == 5 and rest[:1] in 'たて':
                rest = {'た': 'だ', 'て': 'で'}[rest[0]] + rest[1:]
            return override + 'まみむめもん'[idx] + rest
        new = override
    if new is None and stem == '読':
        return '読み込' + form + rest
    if new is None:
        return m.group(0)
    if form == a:
        if rest.startswith('れ'):   # 受け身
            return new + 'さ' + rest
        if rest.startswith('せ'):   # 使役
            return new + 'さ' + rest
        if rest.startswith('ず'):
            return new + 'せ' + rest
        return new + 'し' + rest      # ない
    if form == i or (form == te and te == i):
        if rest.startswith('た') or rest.startswith('て'):
            return new + 'し' + rest
        return new + 'し' + rest      # 連用形（〜し、〜します）
    if form == te:                    # 音便（ん・い・っ）+ だ/で/た/て
        r = rest.replace('だ', 'た', 1) if rest.startswith('だ') else rest.replace('で', 'て', 1) if rest.startswith('で') else rest
        return new + 'し' + r
    if form == u:
        return new + 'する' + rest
    if form == e:
        if rest.startswith('ば'):
            return new + 'すれ' + rest
        return new + 'でき' + rest    # 可能（〜める・〜めない）
    if form == o:
        return new + 'しよ' + rest
    return m.group(0)

VERB_TAILS = ('る', 'た', 'て', 'な', 'ず', 'ま', 'られ', 'させ', 'よう', 'れば', 'ろ')

def conj_ichidan(m):
    stem, rest = m.group('stem'), m.group('rest')
    new = ICHIDAN[stem]
    before = m.string[max(0, m.start() - 1):m.start()]
    if new and not rest.startswith(VERB_TAILS) and (before == 'の' or rest[:1] in ('の', 'を', 'が', 'は', 'も', 'に', 'と', 'だ', 'で')):
        return new + rest             # 名詞（〜の確かめ・知らせ）
    if new and stem in ('確かめ', '控え') and rest.startswith('られ'):
        return new + 'でき' + rest[2:]
    if new is None:                   # 束ねる → まとめる（一段のまま）
        return 'まとめ' + rest
    for a, b in [('られ', 'でき'), ('させ', 'させ'), ('る', 'する'), ('た', 'した'), ('て', 'して'),
                 ('ない', 'しない'), ('なか', 'しなか'), ('ず', 'せず'), ('ま', 'しま'), ('よう', 'しよう'),
                 ('れば', 'すれば'), ('ろ', 'しろ')]:
        if rest.startswith(a):
            return new + b + rest[len(a):]
    if rest[:1] in ('の', 'を', 'が', 'は', 'も'):
        return new + rest             # 名詞（確かめの〜）
    return new + 'し' + rest          # 連用形（〜め、）

def build():
    rules = []
    for old, new in PHRASES:
        rules.append((re.compile(re.escape(old)), new, True))
    # `mount` し直す → もう一度 `mount` する
    def _ascii_naosu(m):
        form, rest = m.group('form'), m.group('rest')
        idx = 'さしすせそ'.index(form)
        if form == 'し' and rest.startswith(('た', 'て')):
            idx = 5
        return 'もう一度 ' + m.group('w') + ' ' + suru_form(idx, rest)
    rules.append((re.compile(r'(?P<w>`[^`]+`|[A-Za-z][\w.]*) し直(?P<form>[さしすせそ])(?P<rest>[ぁ-ん]{0,3})'), _ascii_naosu, True))
    # 効く → 有効になる
    rules.append((re.compile(NK + '効か(?P<a>ない|ず|なか)'), lambda m: '有効になら' + m.group('a')))
    rules.append((re.compile(NK + '効く'), '有効になる'))
    rules.append((re.compile(NK + '効い(?P<r>[たて])'), lambda m: '有効になっ' + m.group('r')))
    rules.append((re.compile(NK + '効き'), '有効になり'))
    # 文脈で置き換え先を変える動詞（行全体に先に当てる。build_context が持つ）
    for ctx, stem, new in []:
        rules.append((re.compile(f'(?P<ctx>{ctx})(?P<stem>{re.escape(stem)})(?P<form>[{"".join(sorted(set(GODAN[stem][:6])))}])(?P<rest>[ぁ-ん]{{0,3}})'),
                      (lambda new: lambda m: m.group('ctx') + conj_godan(m, new))(new)))
    # 起こす → 発生させる
    rules.append((re.compile(NK + '起こ(?P<form>[さしすせそ])(?P<rest>[ぁ-ん]{0,3})'), conj_okosu))
    # V（連用形）+ 直す → もう一度 V
    rules.append((re.compile(r'(?P<v>(?:読み)?[㐀-鿿々]{1,4}[ぁ-ん]?)(?P<i>[きみしいりびぎちめけじえせてれべげね])直(?P<form>[さしすせそ])(?P<rest>[ぁ-ん]{0,3})'), conj_naosu, True))
    for stem, (a, i, u, e, o, te, new) in sorted(GODAN.items(), key=lambda kv: -len(kv[0])):
        forms = ''.join(sorted(set([a, i, u, e, o, te])))
        rules.append((re.compile(NK + f'(?P<stem>{re.escape(stem)})(?P<form>[{forms}])(?P<rest>[ぁ-ん]{{0,3}})'), conj_godan))
    for stem in sorted(ICHIDAN, key=len, reverse=True):
        rules.append((re.compile(NK + f'(?P<stem>{re.escape(stem)})(?P<rest>[ぁ-ん]{{0,4}})'), conj_ichidan))
    # 見る（確認する）
    rules.append((re.compile(NK + '見(?P<rest>(?:る|た|て|ない|ず|ま|れ|よう)[ぁ-ん]{0,3})'), lambda m: conj_ichidan_new('確認', m.group('rest'))))
    # 名詞
    for old, new in [('写した', 'コピーした'), ('写して', 'コピーして'), ('写す', 'コピーする'), ('写さ', 'コピーし'), ('写せ', 'コピーでき'),
                     ('問い', '質問'), ('答え', '回答'), ('写し', 'コピー'), ('を行う', 'をする')]:
        rules.append((re.compile(NK + re.escape(old)), new))
    for old, new in [('揃う', '統一される'), ('揃って', '統一されて'), ('揃った', '統一された'), ('揃わな', '統一されな'), ('揃わず', '統一されず'), ('揃い', '統一され')]:
        rules.append((re.compile(NK + re.escape(old)), new))
    for ch, new in [('印', 'マーカー'), ('版', 'バージョン'), ('節', 'セクション'), ('題', 'タイトル'),
                    ('箱', 'ノード'), ('口', 'インターフェース'), ('形', '構造'), ('語', '単語')]:
        rules.append((re.compile(NK + ch + f'(?!{K})'), new))
    return rules

def conj_ichidan_new(new, rest):
    for a, b in [('られ', 'され'), ('る', 'する'), ('た', 'した'), ('て', 'して'), ('ない', 'しない'),
                 ('ず', 'せず'), ('ま', 'しま'), ('よう', 'しよう'), ('れ', 'すれ')]:
        if rest.startswith(a):
            return new + b + rest[len(a):]
    return new + rest

RULES = build()

def build_context():
    out = []
    for ctx, stem, new in CONTEXT:
        out.append((re.compile(f'(?P<ctx>{ctx})(?P<stem>{re.escape(stem)})(?P<form>[{"".join(sorted(set(GODAN[stem][:6])))}])(?P<rest>[ぁ-ん]{{0,3}})'),
                    (lambda new: lambda m: m.group('ctx') + conj_godan(m, new))(new)))
    return out

CONTEXT_RULES = build_context()
PROTECT = re.compile(r'(?:[^\s\'"`（）、。]*/[^\s\'"`（）、。]*\.(?:md|yaml|yml|ts|html|css|json|js|png|svg))|(?:`[^`\n]*(?:/|\.[a-z]{2,4}\b)[^`\n]*`)|(?:(?<![\w])(?:dev|docs|src|tests|vscode|plugin|scripts|schemas|guide|templates|migrations)/[^\s\'"`）)、。,]+)|(?:#[\w\[\]（）一-鿿ぁ-んァ-ヶー・]+)')
SKIP_KEYS = re.compile(r'^\s*-?\s*(?:callers|decided_by|refs|test|tests|test_file|test_files|path|page|id|kind|ref|source_path|related)\s*:')

def allowed(text, s):
    return any(text.startswith(a, k) for a in ALLOW for k in range(max(0, s - len(a) + 1), s + 1))

import yaml as _yaml
_WL = _yaml.safe_load(open('/mnt/c/Users/shuhe/repo/knowledge/.claude/worktrees/develop/docs/word-list/word-list-ai-slop.yaml', encoding='utf-8'))
_WLR = [(re.compile(e['pattern']) if e.get('pattern') else re.compile(re.escape(e['ng'])), e.get('allow') or []) for e in _WL['entries']]

def hit_positions(t):
    hits = set()
    for pat, al in _WLR:
        for m in pat.finditer(t):
            st = m.start()
            if any(t.startswith(a, k) for a in al for k in range(max(0, st - len(a) + 1), st + 1)):
                continue
            hits.update(range(m.start(), m.end()))
    return hits

def reword_segment(t):
    for rule in RULES:
        pat, new = rule[0], rule[1]
        phrase = len(rule) > 2
        out, last = [], 0
        hits = None if phrase else hit_positions(t)
        for m in pat.finditer(t):
            if 'form' in pat.groupindex and 'i' in pat.groupindex:
                pos = m.start('form') - 1      # 〜直す の「直」
            else:
                pos = m.start('stem') if 'stem' in pat.groupindex else m.start()
            if not phrase and (allowed(t, pos) or pos not in hits):
                continue
            out.append(t[last:m.start()]); out.append(new(m) if callable(new) else new); last = m.end()
        out.append(t[last:]); t = ''.join(out)
    return t

def reword_line(line):
    if SKIP_KEYS.match(line):
        return line
    for pat, new in CONTEXT_RULES:
        hits = hit_positions(line)
        line = pat.sub(lambda m: m.group(0) if allowed(m.string, m.start('stem')) or m.start('stem') not in hits else new(m), line)
    parts, last = [], 0
    for m in PROTECT.finditer(line):
        parts.append(reword_segment(line[last:m.start()])); parts.append(m.group(0)); last = m.end()
    parts.append(reword_segment(line[last:]))
    return ''.join(parts)

def main():
    dry = '--dry' in sys.argv
    for f in [a for a in sys.argv[1:] if a != '--dry']:
        p = pathlib.Path(f); src = p.read_text(encoding='utf-8')
        lines = src.split('\n'); in_skip_list = False; out = []
        for ln in lines:
            if re.match(r'^\s*(?:callers|refs|related|tests|test_files)\s*:\s*$', ln):
                in_skip_list = True; out.append(ln); indent = len(ln) - len(ln.lstrip()); continue
            if in_skip_list:
                if ln.strip().startswith('- ') and (len(ln) - len(ln.lstrip())) >= indent:
                    out.append(ln); continue
                in_skip_list = False
            out.append(reword_line(ln))
        dst = '\n'.join(out)
        if dst != src and not dry:
            p.write_text(dst, encoding='utf-8')
        if dst != src:
            print(sum(1 for a, b in zip(src.split('\n'), dst.split('\n')) if a != b), f)

if __name__ == '__main__':
    main()
