#!/usr/bin/env bash
set -euo pipefail

SERVER="root@164.68.103.207"
REMOTE_DIR="/var/www/MotoTaxi"
SERVICE="mototaxi"

cd "$(dirname "$0")"

echo "==> 1/4 Compile (sirf badli hui files)"
python setup.py build_ext --inplace

echo "==> 2/4 Upload"
RSYNC_FLAGS="-av"
[ "${DRY_RUN:-0}" = "1" ] && RSYNC_FLAGS="-avn"

rsync $RSYNC_FLAGS \
  --exclude="venv/" --exclude=".git/" --exclude=".idea/" \
  --exclude="build/" --exclude="__pycache__/" \
  --exclude="*.c" --exclude="db.sqlite3" --exclude="media/" \
  --include="*/" \
  --include="*.so" \
  --include="migrations/*.py" \
  --include="__init__.py" \
  --include="requirements.txt" --include="locale/***" \
  --exclude="*" \
  -e "ssh -p 22" \
  ./ "$SERVER:$REMOTE_DIR/"

[ "${DRY_RUN:-0}" = "1" ] && { echo "Dry run khatam, kuch upload nahi hua."; exit 0; }

echo "==> 3/4 Server par migrate + restart"
ssh "$SERVER" "cd $REMOTE_DIR && source venv/bin/activate \
  && pip install -q -r requirements.txt \
  && python manage.py migrate --noinput \
  && python manage.py collectstatic --noinput -v0 \
  && systemctl restart $SERVICE"

echo "==> 4/4 Status"
ssh "$SERVER" "systemctl is-active $SERVICE && journalctl -u $SERVICE -n 15 --no-pager"