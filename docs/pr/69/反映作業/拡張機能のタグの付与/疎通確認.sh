#!/bin/sh
# 拡張機能のタグの付与が触る GitHub のリポジトリ（タグ・Release）へ、読み取りだけでつながるかを確かめる
set -eu

REPO=shuhei1101/mdmark

# タグの一覧を読めるか
if git ls-remote --tags origin >/dev/null 2>&1; then
  echo "origin のタグの読み取り: ok"
else
  echo "origin のタグの読み取り: failed"
  exit 1
fi

# GitHub の API（Release）を読めるか
if gh api "repos/$REPO/releases?per_page=1" >/dev/null 2>&1; then
  echo "GitHub の Release の読み取り: ok"
else
  echo "GitHub の Release の読み取り: failed"
  exit 1
fi
