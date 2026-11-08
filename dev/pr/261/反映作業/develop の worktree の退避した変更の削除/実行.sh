#!/bin/sh
# develop の worktree に退避した mdmark#157 の stash を削除する
set -eu

WORKTREE=/mnt/c/Users/shuhe/repo/mdmark/.claude/worktrees/develop
MESSAGE_PREFIX="On develop: mdmark#157 の拡張機能の名前の変更"
BACKUP=/mnt/c/Users/shuhe/repo/mdmark/.claude/pr261-dropped-stash.sha
# 同じ変更が入っているかを見る ref（マージ前の dry-run では作業ブランチを渡す）
DEVELOP_REF="${DEVELOP_REF:-origin/develop}"

# 前提確認: DEVELOP_REF に同じ変更が入っている
git -C "$WORKTREE" fetch -q origin
if git -C "$WORKTREE" show "$DEVELOP_REF:vscode/package.json" | grep -q '"name": "mdmark-vscode"' \
  && git -C "$WORKTREE" show "$DEVELOP_REF:vscode/package.json" | grep -q '"displayName": "mdmark for VS Code"' \
  && git -C "$WORKTREE" show "$DEVELOP_REF:vscode/tests/integration/helpers.ts" | grep -q 'EXTENSION_ID = "ShuheiNishikawa.mdmark-vscode"'; then
  echo "前提確認（$DEVELOP_REF に同じ変更がある）: ok"
else
  echo "前提確認（$DEVELOP_REF に同じ変更がある）: failed"
  exit 1
fi

# 計画: メッセージで stash を引く（--dry-run もここを通る）
MATCHES=$(git -C "$WORKTREE" stash list --format='%gd|%H|%gs' | grep -F "|$MESSAGE_PREFIX" || true)
COUNT=$(printf '%s' "$MATCHES" | grep -c . || true)
if [ "$COUNT" -eq 0 ]; then
  echo "stash の削除: skipped"
  exit 0
fi
if [ "$COUNT" -gt 1 ]; then
  echo "前提確認（対象の stash が 1 件）: failed"
  printf '%s\n' "$MATCHES"
  exit 1
fi
REF=$(printf '%s' "$MATCHES" | cut -d'|' -f1)
SHA=$(printf '%s' "$MATCHES" | cut -d'|' -f2)
echo "対象: $REF $SHA"
git -C "$WORKTREE" stash show --stat "$REF"
if [ "${1:-}" = "--dry-run" ]; then
  echo "stash の削除: changed"
  exit 0
fi

# 適用: 退避 → 削除
printf '%s\n' "$SHA" > "$BACKUP"
echo "退避（$BACKUP）: ok"
git -C "$WORKTREE" stash drop "$REF"
echo "stash の削除: changed"
