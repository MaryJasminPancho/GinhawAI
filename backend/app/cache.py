import redis.asyncio as redis
from app.config import REDIS_HOST, REDIS_PORT

def create_redis_client():
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, protocol=2)