"""Shared SlowAPI limiter for authentication routes."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# The default memory store is process-local. Deployments running multiple API
# workers should configure a shared storage backend when coordinating limits.
limiter = Limiter(key_func=get_remote_address)
