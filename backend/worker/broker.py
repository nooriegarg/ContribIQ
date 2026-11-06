"""
TaskIQ broker connected to Valkey.

Intentional bug: no result_ttl is set, so the default of 60 seconds is used.
If the frontend tab is backgrounded or slow, the analysis result expires before
the frontend polls for it.
Issue to raise: "Task result TTL is 60s — analysis results expire before frontend retrieves them"
Fix: pass result_ttl=3600 to ListQueueBroker so results survive for 1 hour.
"""

from taskiq_valkey import ListQueueBroker

from backend.core.config import get_settings

broker = ListQueueBroker(url=get_settings().VALKEY_URL)
