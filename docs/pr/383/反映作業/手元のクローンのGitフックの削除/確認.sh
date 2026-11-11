#!/bin/sh
set -eu

rc=0
for hook in pre-commit pre-push; do
  if [ -e "/mnt/c/Users/shuhe/repo/mdmark/.git/hooks/$hook" ]; then
    echo "$hook のフック: failed（残っている）"
    rc=1
  else
    echo "$hook のフック: ok（無い）"
  fi
done
exit $rc
