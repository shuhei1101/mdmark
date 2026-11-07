#!/bin/sh
set -eu

# 手元のクローンが Git のリポジトリとして読めるか
if git -C /mnt/c/Users/shuhe/repo/mdmark rev-parse --git-common-dir >/dev/null 2>&1; then
  echo "手元のクローン: ok"
else
  echo "手元のクローン: failed"
  exit 1
fi

# 全ての worktree が共有するフックのフォルダが読めるか
if [ -d /mnt/c/Users/shuhe/repo/mdmark/.git/hooks ] && [ -r /mnt/c/Users/shuhe/repo/mdmark/.git/hooks ]; then
  echo "フックのフォルダ: ok"
else
  echo "フックのフォルダ: failed"
  exit 1
fi

# develop と master の package.json が読めるか
for branch in develop master; do
  if git -C /mnt/c/Users/shuhe/repo/mdmark show "origin/$branch:package.json" >/dev/null 2>&1; then
    echo "$branch の package.json: ok"
  else
    echo "$branch の package.json: failed"
    exit 1
  fi
done
