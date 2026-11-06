from taskiq_valkey import ListQueueBroker

from backend.core.config import get_settings

broker = ListQueueBroker(url=get_settings().VALKEY_URL)
