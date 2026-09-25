import redis.asyncio as redis
from app.config import REDIS_HOST, REDIS_PORT

def create_redis_client():
    # Timeouts so requests fail fast (with a clear error) when Redis isn't running,
    # instead of hanging forever.
    return redis.Redis(
        host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, protocol=2,
        socket_connect_timeout=3, socket_timeout=5,
    )
