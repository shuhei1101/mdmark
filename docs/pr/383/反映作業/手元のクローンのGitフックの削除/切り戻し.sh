#!/bin/sh
set -eu

restored=0
for hook in pre-commit pre-push; do
  if [ -f "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks-backup-383/$hook" ]; then
    cp -p "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks-backup-383/$hook" "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook"
    restored=1
  fi
done
if [ "$restored" -eq 0 ]; then
  echo "退避したフック: failed"
  exit 1
fi
echo "フックの書き戻し: changed"
