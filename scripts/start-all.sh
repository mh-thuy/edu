```bash
#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/edu.log"
PID_FILE="$APP_DIR/edu.pid"

mkdir -p "$LOG_DIR"

# Load NVM nếu Node.js được cài bằng nvm
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

cd "$APP_DIR"

echo "========================================"
echo "Starting Edu"
echo "Directory: $APP_DIR"
echo "Log: $LOG_FILE"
echo "========================================"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git not found"
  exit 1
fi

echo "Node: $(node -v)"
echo "NPM : $(npm -v)"
echo "Git : $(git --version)"

# Không cho chạy trùng
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"

  if kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "Edu is already running."
    echo "PID: $OLD_PID"
    exit 0
  else
    echo "Removing stale PID file..."
    rm -f "$PID_FILE"
  fi
fi

echo ""
echo "Pulling latest source..."
git pull

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Building Edu..."
npm run build

echo ""
echo "Starting Edu in background..."

nohup npm run start >> "$LOG_FILE" 2>&1 </dev/null &

APP_PID=$!
echo "$APP_PID" > "$PID_FILE"

sleep 2

if ! kill -0 "$APP_PID" >/dev/null 2>&1; then
  echo "ERROR: Edu failed to start."
  rm -f "$PID_FILE"

  echo ""
  echo "Last log:"
  tail -n 30 "$LOG_FILE"

  exit 1
fi

echo ""
echo "Edu started successfully."
echo "PID: $APP_PID"
echo "Log: $LOG_FILE"
echo ""
echo "View log:"
echo "tail -f $LOG_FILE"
```
