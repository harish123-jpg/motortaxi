import asyncio
import logging

from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 5

_task = None


@database_sync_to_async
def _run_expiry():
    from rides.cancellation import expire_stale_searching_rides
    return expire_stale_searching_rides()


async def _loop():
    while True:
        try:
            expired = await _run_expiry()
            if expired:
                logger.info("Expired %s stale searching rides", expired)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Ride expiry loop error")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)


def ensure_expiry_loop():
    global _task
    if _task is None or _task.done():
        _task = asyncio.get_running_loop().create_task(_loop())