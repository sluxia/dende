#!/usr/bin/env bash
# Manages the project-local PostGIS cluster (micromamba/conda-forge install).
# This is a Docker-free alternative used when Docker Desktop cannot pull images.
#
#   ./local-pg.sh start    init (once) + start + ensure postgis + create db
#   ./local-pg.sh stop
#   ./local-pg.sh status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_DIR="$ROOT/.conda-env"
PGDATA="$ENV_DIR/pgdata"
PGLOG="$ENV_DIR/pg.log"
PGPORT="${PGPORT:-5432}"
DBNAME="${DBNAME:-dende_registry}"
DBUSER="${DBUSER:-dende}"

PG_BIN="$ENV_DIR/bin"
PSQL=("$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER")

require_env() {
  if [ ! -x "$PG_BIN/postgres" ]; then
    echo "PostGIS env missing at $ENV_DIR. Install it once with:" >&2
    echo "  micromamba create -y -p $ENV_DIR -c conda-forge postgis" >&2
    exit 1
  fi
}

start() {
  require_env
  if [ ! -d "$PGDATA" ]; then
    echo "Initializing cluster..."
    "$PG_BIN/initdb" -D "$PGDATA" -U "$DBUSER" --auth=trust --encoding=UTF8 --no-locale
  fi
  if "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "Already running."
  else
    "$PG_BIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -h 127.0.0.1" -l "$PGLOG" start
  fi
  "${PSQL[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" | grep -q 1 \
    || "${PSQL[@]}" -d postgres -c "CREATE DATABASE $DBNAME"
  "${PSQL[@]}" -d "$DBNAME" -tAc "SELECT 1 FROM pg_extension WHERE extname='postgis'" | grep -q 1 \
    || "${PSQL[@]}" -d "$DBNAME" -c "CREATE EXTENSION postgis"
  echo "PostGIS ready at postgres://$DBUSER@127.0.0.1:$PGPORT/$DBNAME"
}

stop() {
  "$PG_BIN/pg_ctl" -D "$PGDATA" stop 2>/dev/null && echo "Stopped." || echo "Not running."
}

status() {
  "$PG_BIN/pg_ctl" -D "$PGDATA" status 2>/dev/null || echo "Not running."
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "usage: $0 {start|stop|status}" >&2; exit 2 ;;
esac
