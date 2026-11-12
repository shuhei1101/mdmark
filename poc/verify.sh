#!/usr/bin/env bash
# version の有無ごとに、git の URL で追加したマーケットプレイスのプラグインが commit で更新されるかを確かめる
# 使い方: bash poc/verify.sh（CLAUDE_CONFIG_DIR を一時フォルダに分け、ユーザーの設定に触れない）
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
PORT=18494
echo "work: $WORK"
claude --version

# file:// と git:// は marketplace add が受け付けないため、git http-backend の smart HTTP で配る
python3 -I "$HERE/git_http.py" "$WORK" "$PORT" > "$WORK/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER' EXIT
until (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null; do sleep 1; done

show() { python3 -I -c 'import json,sys;d=json.load(open(sys.argv[1]));e=list(d["plugins"].values())[0][0];print({k:e.get(k) for k in ("version","gitCommitSha","installPath")})' "$1/plugins/installed_plugins.json"; }

run_case() {
  local name=$1 with_version=$2
  local src=$WORK/$name-src bare=$WORK/$name.git cfg=$WORK/$name-config
  mkdir -p "$src/.claude-plugin" "$src/plugin/.claude-plugin" "$src/plugin/skills/hello" "$cfg"
  echo '{"name":"m'$name'","owner":{"name":"poc"},"plugins":[{"name":"p'$name'","source":"./plugin","description":"poc"}]}' > "$src/.claude-plugin/marketplace.json"
  if [ "$with_version" = yes ]; then
    echo '{"name":"p'$name'","version":"v0.1.0","description":"poc"}' > "$src/plugin/.claude-plugin/plugin.json"
  else
    echo '{"name":"p'$name'","description":"poc"}' > "$src/plugin/.claude-plugin/plugin.json"
  fi
  printf -- '---\nname: hello\ndescription: poc\n---\nfirst\n' > "$src/plugin/skills/hello/SKILL.md"
  git -C "$src" init -q -b develop && git -C "$src" add -A && git -C "$src" -c user.name=poc -c user.email=poc@example.invalid commit -q -m first
  git clone -q --bare "$src" "$bare"
  echo "== [$name] version=$with_version first=$(git -C "$src" rev-parse HEAD)"
  export CLAUDE_CONFIG_DIR=$cfg
  claude plugin marketplace add "http://127.0.0.1:$PORT/$name.git" > /dev/null 2>&1; echo "marketplace add exit=$?"
  claude plugin install "p$name@m$name" > /dev/null 2>&1; echo "install exit=$?"
  echo "after install: $(show "$cfg")"
  printf -- '---\nname: hello\ndescription: poc\n---\nsecond\n' > "$src/plugin/skills/hello/SKILL.md"
  git -C "$src" -c user.name=poc -c user.email=poc@example.invalid commit -q -am second
  git -C "$src" push -q "$bare" develop
  echo "second=$(git -C "$src" rev-parse HEAD)"
  claude plugin marketplace update "m$name" > /dev/null 2>&1; echo "marketplace update exit=$?"
  echo "after marketplace update: $(show "$cfg")"
  claude plugin update "p$name@m$name" 2>&1 | tail -1; echo "plugin update exit=${PIPESTATUS[0]}"
  echo "after plugin update: $(show "$cfg")"
  local path; path=$(python3 -I -c 'import json,sys;d=json.load(open(sys.argv[1]));print(list(d["plugins"].values())[0][0]["installPath"])' "$cfg/plugins/installed_plugins.json")
  echo "SKILL.md の最後の行: $(tail -1 "$path/skills/hello/SKILL.md")"
  unset CLAUDE_CONFIG_DIR
}
run_case noversion no
run_case withversion yes
