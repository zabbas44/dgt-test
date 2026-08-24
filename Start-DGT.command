#!/bin/bash
# Double-click this file to run the DGT trainer as a proper local web app.
#
# Why bother, when Test-DGT.html opens on its own? Because a real http:// address
# makes every browser save your progress reliably, and it prints an address you
# can open on your phone over the same Wi-Fi.
cd "$(dirname "$0")" || exit 1

PORT=8777
while lsof -i ":$PORT" >/dev/null 2>&1; do PORT=$((PORT + 1)); done

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

echo ""
echo "  DGT Theory Trainer"
echo "  ------------------------------------------------------"
echo "  On this Mac:  http://localhost:$PORT/Test-DGT.html"
if [ -n "$IP" ]; then
  echo "  On your phone (same Wi-Fi):"
  echo "                http://$IP:$PORT/Test-DGT.html"
fi
echo ""
echo "  Leave this window open while you study."
echo "  Close it (or press Ctrl+C) when you are done."
echo "  ------------------------------------------------------"
echo ""

sleep 1 && open "http://localhost:$PORT/Test-DGT.html" &
exec python3 -m http.server "$PORT" --bind 0.0.0.0
