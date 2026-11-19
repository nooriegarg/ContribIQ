from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from backend.core.config import get_settings

settings = get_settings()
# BRPOP waits indefinitely; a read timeout restarts idle workers and interrupts tasks.
broker = ListQueueBroker(url=settings.VALKEY_URL, socket_timeout=None).with_result_backend(
    RedisAsyncResultBackend(
        redis_url=settings.VALKEY_URL,
        result_ex_time=86400,
        prefix_str="task-result",
    )
)
