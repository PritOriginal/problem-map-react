#!/usr/bin/env bash
# PostToolUse: after Edit/Write on src/**.{ts,tsx} — eslint --fix the file, then typecheck the app project.
set -u
cd "$(dirname "$0")/../.." || exit 0
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.tool_input?.file_path||"")}catch{}})')
case "$file" in
  */src/*.ts|*/src/*.tsx|src/*.ts|src/*.tsx) ;;
  *) exit 0 ;;
esac
out=$(node_modules/.bin/eslint --fix "$file" 2>&1)
status=$?
tsout=$(node_modules/.bin/tsgo --noEmit -p tsconfig.app.json 2>&1 | head -30)
if [ $status -ne 0 ] || [ -n "$tsout" ]; then
  printf 'eslint/tsgo reported problems for %s:\n%s\n%s\n' "$file" "$out" "$tsout" >&2
  exit 2
fi
exit 0
