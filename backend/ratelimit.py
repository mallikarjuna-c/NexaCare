import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, message: str):
        self.limit = limit
        self.window = window_seconds
        self.message = message
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str) -> deque[float]:
        now = time.monotonic()
        recent = self.hits[key]
        while recent and now - recent[0] > self.window:
            recent.popleft()
        if not recent:
            self.hits.pop(key, None)
            return deque()
        return recent

    def check(self, key: str) -> None:
        if len(self._prune(key)) >= self.limit:
            raise HTTPException(429, self.message)

    def hit(self, key: str) -> None:
        self._prune(key)
        self.hits[key].append(time.monotonic())


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
