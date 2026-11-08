#!/bin/sh
# develop の worktree に mdmark#157 の stash が残っていないかを確かめる
set -eu

WORKTREE=/mnt/c/Users/shuhe/repo/mdmark/.claude/worktrees/develop
MESSAGE_PREFIX="On develop: mdmark#157 の拡張機能の名前の変更"

if git -C "$WORKTREE" stash list --format='%gs' | grep -qF "$MESSAGE_PREFIX"; then
  echo "mdmark#157 の stash: failed"
  git -C "$WORKTREE" stash list
  exit 1
fi
echo "mdmark#157 の stash: ok"
