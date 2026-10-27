#!/usr/bin/env bash
set -euo pipefail

SERVER="root@164.68.103.207"
REMOTE_DIR="/var/www/MotoTaxi"
SERVICE="mototaxi"
SSH_OPTS="-o ControlMaster=auto -o ControlPath=/tmp/mototaxi-ssh-%r@%h:%p -o ControlPersist=120"

cd "$(dirname "$0")"

echo "==> 1/4 Compile (sirf badli hui files)"
python setup.py build_ext --inplace

echo "==> 2/4 Upload"
RSYNC_FLAGS="-av"
[ "${DRY_RUN:-0}" = "1" ] && RSYNC_FLAGS="-avn"

rsync $RSYNC_FLAGS \
  --exclude="venv/" --exclude=".git/" --exclude=".idea/" \
  --exclude="build/" --exclude="__pycache__/" \
  --exclude="*.c" --exclude="*.pyc" --exclude="db.sqlite3" \
  --exclude="media/" --exclude="staticfiles/" \
  --exclude="driver_documents/" --exclude="vehicle_documents/" \
  --exclude="/*.so" \
  --include="*/" \
  --include="*.so" \
  --include="migrations/*.py" \
  --include="__init__.py" \
  --include="requirements.txt" \
  --include="locale/***" \
  --include="templates/***" --include="**/templates/***" \
  --include="template/***" --include="**/template/***" \
  --include="static/***" --include="**/static/***" \
  --exclude="*" \
  --no-perms --no-group --omit-dir-times \
  -e "ssh $SSH_OPTS" \
  ./ "$SERVER:$REMOTE_DIR/"

[ "${DRY_RUN:-0}" = "1" ] && { echo "Dry run khatam, kuch upload nahi hua."; exit 0; }

echo "==> 3/4 Server par migrate + static + restart"
ssh $SSH_OPTS "$SERVER" "cd $REMOTE_DIR && source venv/bin/activate \
  && pip install -q -r requirements.txt \
  && python manage.py migrate --noinput \
  && python manage.py collectstatic --noinput -v0 \
  && systemctl restart $SERVICE"

echo "==> 4/4 Status"
ssh $SSH_OPTS "$SERVER" "systemctl is-active $SERVICE && journalctl -u $SERVICE -n 15 --no-pager"