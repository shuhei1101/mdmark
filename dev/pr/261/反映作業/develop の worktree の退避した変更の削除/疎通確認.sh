#!/bin/sh
# develop の worktree の stash が読めるかを確かめる（状態は変えない）
set -eu

WORKTREE=/mnt/c/Users/shuhe/repo/mdmark/.claude/worktrees/develop

if git -C "$WORKTREE" stash list >/dev/null 2>&1; then
  echo "develop の worktree の stash: ok"
else
  echo "develop の worktree の stash: failed"
  exit 1
fi
