#!/usr/bin/env bash
# Runs the API and the web server side by side. The API stays on localhost (adr-0010); only the web port is
# published. SIGTERM/SIGINT go to both; when either exits, the other is stopped and the container exits with it.
set -uo pipefail

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
