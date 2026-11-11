#!/bin/sh
# 削除した mdmark#157 の stash を、退避した SHA から戻す
set -eu

WORKTREE=/mnt/c/Users/shuhe/repo/mdmark/.claude/worktrees/develop
BACKUP=/mnt/c/Users/shuhe/repo/mdmark/.claude/pr261-dropped-stash.sha

if [ ! -f "$BACKUP" ]; then
  echo "退避した SHA: failed"
  exit 1
fi
SHA=$(cat "$BACKUP")
git -C "$WORKTREE" stash store -m "On develop: mdmark#157 の拡張機能の名前の変更（切り戻し）" "$SHA"
echo "stash の書き戻し: changed"
