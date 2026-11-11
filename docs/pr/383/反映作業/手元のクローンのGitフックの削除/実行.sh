#!/bin/sh
set -eu

# 前提確認
if [ $# -gt 1 ] || { [ $# -eq 1 ] && [ "$1" != "--dry-run" ]; }; then
  echo "前提確認: failed"
  exit 1
fi
if [ ! -d /mnt/c/Users/shuhe/repo/mdmark/.git/hooks ]; then
  echo "前提確認: failed"
  exit 1
fi
# develop か master の package.json に lefthook が残っていると、そこから作った worktree の npm ci がフックを入れ直す
git -C /mnt/c/Users/shuhe/repo/mdmark fetch -q origin develop master
for branch in develop master; do
  if git -C /mnt/c/Users/shuhe/repo/mdmark show "origin/$branch:package.json" | grep -q '"lefthook"'; then
    echo "$branch の package.json の lefthook: failed"
    exit 1
  fi
  echo "$branch の package.json の lefthook: ok"
done
# lefthook が入れたフック以外は削除しない
for hook in pre-commit pre-push; do
  path="/mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook"
  if [ -f "$path" ] && ! grep -q 'call_lefthook' "$path"; then
    echo "前提確認（$hook が lefthook のフック）: failed"
    exit 1
  fi
done
echo "前提確認: ok"

# 計画（--dry-run もここを通る）
targets=""
for hook in pre-commit pre-push; do
  if [ -f "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook" ]; then
    targets="$targets $hook"
    echo "削除の対象: /mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook"
  fi
done
if [ -z "$targets" ]; then
  echo "フックの削除: skipped"
  exit 0
fi
if [ "${1:-}" = "--dry-run" ]; then
  echo "フックの削除: changed"
  exit 0
fi

# 適用（退避 → 退避の確認 → 削除）
mkdir -p /mnt/c/Users/shuhe/repo/mdmark/.git/hooks-backup-383
for hook in $targets; do
  cp -p "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook" "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks-backup-383/$hook"
  if ! cmp -s "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook" "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks-backup-383/$hook"; then
    echo "退避（$hook）: failed"
    exit 1
  fi
done
echo "退避: ok"
for hook in $targets; do
  rm "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook"
done
echo "フックの削除: changed"
