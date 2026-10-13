#!/usr/bin/env bash
# Two shapes (adr-0010, adr-0016). Studio and assistant (default): the API on localhost and the web server on the
# published port, side by side; SIGTERM/SIGINT go to both, and when either exits the other is stopped and the
# container exits with it. API only (OPEN_DRAMA_WEB_UI=0): the API alone on the published port, no web process.
set -uo pipefail

if [ "${OPEN_DRAMA_WEB_UI:-1}" = "0" ] || [ "${OPEN_DRAMA_WEB_UI:-1}" = "false" ]; then
  cd /app/apps/api && HOST=0.0.0.0 PORT=3000 exec node dist/index.js
fi

export API_ORIGIN=http://127.0.0.1:4000

(cd /app/apps/api && HOST=127.0.0.1 PORT=4000 exec node dist/index.js) &
api=$!
(cd /app/web && HOSTNAME=0.0.0.0 PORT=3000 exec node apps/web/server.js) &
web=$!

stop() { kill -TERM "$api" "$web" 2>/dev/null; }
trap stop TERM INT

wait -n "$api" "$web"
status=$?
stop
wait "$api" "$web" 2>/dev/null
exit "$status"
