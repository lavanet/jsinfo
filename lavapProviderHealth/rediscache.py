import redis
import logging
import env
from utils import convert_dict_to_dbjson, json_load_or_none

class RedisCacheClass:
    def __init__(self, key_prefix: str, debug_logs: bool = False):
        self.key_prefix = key_prefix
        self.debug_logs = debug_logs
        self.redis_url = None
        self.client = None
        self.initialize_client()

    def initialize_client(self):
        self.redis_url = env.REDIS_SERVER
        if not self.redis_url:
            self.log('JSINFO_QUERY_REDDIS_CACHE environment variable is not set.')
            return
        self.connect()

    def connect(self):
        if not self.redis_url:
            return
        self.log('Attempting to reconnect to Redis...')
        try:
            self.client = redis.Redis.from_url(self.redis_url, socket_connect_timeout=5)  # 5 seconds timeout
            self.client.ping()  # Check connection
        except redis.RedisError as err:
            self.log_error('Failed to connect to Redis', err)
            self.client = None

    def reconnect(self):
        try:
            self.connect()
        except Exception as error:
            self.log_error('Redis reconnect failed', error)

    def get(self, key: str):
        if not self.client:
            self.log('Redis client is not available.')
            return None

        full_key = self.key_prefix + key
        try:
            result = self.client.get(full_key)
            if result is None:
                self.log(f'Cache miss for key {full_key}.')
                return None
            else:
                self.log(f'Cache hit for key {full_key}.')
                return result.decode('utf-8')
        except Exception as error:
            self.log_error(f'Error getting key {full_key} from Redis.', error)
            self.reconnect()
            return None

    def set(self, key: str, value: str, ttl: int = 30):
        if not self.client:
            self.log('Redis client is not available.')
            return

        try:
            self.client.setex(self.key_prefix + key, ttl, value)
        except Exception as error:
            self.log_error(f'Error setting key {self.key_prefix + key} in Redis', error)
            self.reconnect()

    def get_array(self, key: str) -> list | None:
        result = self.get(key)
        if not result:
            return None
        return json_load_or_none(result)

    def set_array(self, key: str, value: list, ttl: int = 30):
        try:
            string_value = convert_dict_to_dbjson(value)
            self.set(key, string_value, ttl)
        except Exception as error:
            self.log_error(f'Error serializing array for key {self.key_prefix + key}', error)

    def get_dict(self, key: str) -> dict | None:
        result = self.get(key)
        if not result:
            return None
        return json_load_or_none(result, )

    def set_dict(self, key: str, value: dict, ttl: int = 30):
        try:
            string_value = convert_dict_to_dbjson(value)
            self.set(key, string_value, ttl)
        except Exception as error:
            self.log_error(f'Error serializing dict for key {self.key_prefix + key}', error)
            
    def lpush_dict(self, key: str, value: dict):
        if not self.client:
            self.log('Redis client is not available.')
            return

        full_key = self.key_prefix + key
        try:            
            self.client.lpush(full_key, convert_dict_to_dbjson(value))
        except Exception as error:
            self.log_error(f'Error LPUSH to key {full_key} in Redis', error)
            self.reconnect()

    def brpop_dict(self, key: str, timeout: int = 0) -> dict | None:
        if not self.client:
            self.log('Redis client is not available.')
            return None

        full_key = self.key_prefix + key
        try:
            result = self.client.brpop(full_key, timeout)
            if result is None:
                self.log(f'BRPOP timeout or no elements for key {full_key}.')
                return None
            else:
                # result is a tuple (key, value), where value is the element popped
                return json_load_or_none(result[1])
        except Exception as error:
            self.log_error(f'Error BRPOP from key {full_key} in Redis.', error)
            self.reconnect()
            return None
    
    def log(self, message: str):
        if not self.debug_logs:
            return
        logging.info(f'RedisCache: {message}')

    def log_error(self, message: str, error):
        logging.error(f'RedisCache: {message}', exc_info=error)

rediscache = RedisCacheClass("jsinfo-healthp")