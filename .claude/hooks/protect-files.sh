#!/usr/bin/env bash
# PreToolUse: block edits to .env and package-lock.json (lock file changes go through npm).
set -u
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path||"")}catch{}})')
case "$(basename "$file")" in
  .env|.env.local|.env.production|package-lock.json)
    echo "Blocked: $file must not be edited by Claude (edit it manually / use npm)." >&2
    exit 2 ;;
esac
exit 0
