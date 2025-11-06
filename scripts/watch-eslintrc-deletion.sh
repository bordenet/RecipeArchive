#!/bin/bash
# File watcher to catch deletion of .eslintrc.cjs files

set -e

WATCH_FILES=(
  ".eslintrc.cjs"
  "extensions/.eslintrc.cjs"
  "tools/linting/.eslintrc.cjs"
)

LOG_FILE="./.eslintrc-deletion-trace.log"

echo "🔍 Starting .eslintrc.cjs file watcher..." | tee "$LOG_FILE"
echo "Monitoring files: ${WATCH_FILES[*]}" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Function to capture process info when deletion detected
capture_deletion_event() {
  local file=$1
  echo "🚨 DELETION DETECTED: $file at $(date)" | tee -a "$LOG_FILE"
  echo "Current process tree:" | tee -a "$LOG_FILE"
  pstree -p $$ 2>/dev/null || ps -ef | grep -E "($$|eslint|npm|node|validate)" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  echo "Recent processes:" | tee -a "$LOG_FILE"
  ps aux | grep -E "(eslint|npm|node|validate)" | grep -v grep | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  echo "Stack trace (if available):" | tee -a "$LOG_FILE"
  caller 2>/dev/null | tee -a "$LOG_FILE" || echo "No stack trace available" | tee -a "$LOG_FILE"
  echo "================================" | tee -a "$LOG_FILE"
}

# Use fswatch if available, otherwise fall back to polling
if command -v fswatch >/dev/null 2>&1; then
  echo "Using fswatch for monitoring..." | tee -a "$LOG_FILE"

  # Monitor all three files
  fswatch -0 -e ".*" -i "\\.eslintrc\\.cjs$" . | while read -d "" event; do
    for file in "${WATCH_FILES[@]}"; do
      if [[ "$event" == *"$file"* ]] && [[ ! -f "$file" ]]; then
        capture_deletion_event "$file"
      fi
    done
  done
else
  echo "fswatch not found, using polling mode..." | tee -a "$LOG_FILE"
  echo "Install fswatch for better performance: brew install fswatch" | tee -a "$LOG_FILE"

  # Polling fallback
  while true; do
    for file in "${WATCH_FILES[@]}"; do
      if [[ ! -f "$file" ]]; then
        capture_deletion_event "$file"

        # Restore the file immediately
        if [[ "$file" == ".eslintrc.cjs" ]]; then
          cat > "$file" << 'EOF'
/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  env: {
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json"],
  },
  rules: {
    quotes: ["error", "double"],
  },
};
EOF
          echo "✅ Restored $file" | tee -a "$LOG_FILE"
        fi
      fi
    done
    sleep 0.1  # Check every 100ms
  done
fi
