import os, json, threading, string, time, random
from dateutil.relativedelta import relativedelta
from utils import get_env_var, log, parse_dotenv_for_var

# Constants
POSTGRES_URL = os.environ.get('JSINFO_HEALTHPROBEJOB_POSTGRESQL_URL', 'postgres://jsinfo:secret@localhost:5432/jsinfo')
PROVIDERS_URL: str = get_env_var('JSINFO_HEALTHPROBEJOB_PROVIDERS_URL', "https://jsinfo.lavanet.xyz/providers")
NODE_URL: str = get_env_var('JSINFO_HEALTHPROBEJOB_NODE_URL', "https://public-rpc.lavanet.xyz:443")

EMPTY_ACCOUNTINFO_CHECK_INTERVAL = relativedelta(days=int(get_env_var('JSINFO_HEALTHPROBEJOB_EMPTY_ACCOUNTINFO_CHECK_INTERVAL', 1)))
DEBUG_PRINT_ACCOUNT_INFO_STDOUT: bool = get_env_var('JSINFO_HEALTHPROBEJOB_DEBUG_PRINT_ACCOUNT_INFO_STDOUT', 'False') == 'True'
HTTP_SERVER_ADDRESS: tuple[str, int] = tuple(json.loads(get_env_var('JSINFO_HEALTHPROBEJOB_HTTP_SERVER_ADDRESS', json.dumps(('127.0.0.1', 6500)))))
GEO_LOCATION: bool = get_env_var('JSINFO_HEALTHPROBEJOB_GEO_LOCATION', 'EU')
CD_ON_START: str = get_env_var('JSINFO_HEALTHPROBEJOB_CD_ON_START', "~/Documents/lava_projects/lava/config/health_examples")

BATCH_AMOUNT: int = get_env_var('JSINFO_HEALTHPROBEJOB_BATCH_AMOUNT', 8)

# Parse some vars from the .env file
env_var_value = parse_dotenv_for_var('JSINFO_HEALTHPROBEJOB_POSTGRESQL_URL')
if env_var_value:
    POSTGRES_URL = env_var_value
    log("env", "The JSINFO_HEALTHPROBEJOB_POSTGRESQL_URL env file was loaded from disk.")
env_var_value = parse_dotenv_for_var('JSINFO_HEALTHPROBEJOB_NODE_URL')
if env_var_value:
    NODE_URL = env_var_value
    log("env", "The JSINFO_HEALTHPROBEJOB_NODE_URL env file was loaded from disk:" + env_var_value)

HEALTH_RESULTS_GUID: str = ''.join(random.choices(string.ascii_letters + string.digits, k=32))

def update_guid() -> None:
    global HEALTH_RESULTS_GUID
    log("env: update_guid (start)", "new HEALTH_RESULTS_GUID: " + HEALTH_RESULTS_GUID)
    counter = 0
    while True:
        HEALTH_RESULTS_GUID = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        counter += 1
        log("env: update_guid (loop)", "new HEALTH_RESULTS_GUID: " + HEALTH_RESULTS_GUID + ", loop count: " + str(counter))
        time.sleep(15 * 60)
        
threading.Thread(target=update_guid).start()

def get_reddis_server():
    env_var_value = get_env_var('JSINFO_HEALTHPROBEJOB_REDIS_URL', None)
    if env_var_value:
        log("get_reddis_server", "The JSINFO_HEALTHPROBEJOB_REDIS_URL came from env")
        return env_var_value

    env_var_value = get_env_var('JSINFO_QUERY_REDDIS_CACHE', None)
    if env_var_value:
        log("get_reddis_server", "The JSINFO_QUERY_REDDIS_CACHE came from env")
        return env_var_value

    env_var_value = parse_dotenv_for_var('JSINFO_HEALTHPROBEJOB_REDIS_URL')
    if env_var_value:
        log("get_reddis_server", "The JSINFO_HEALTHPROBEJOB_REDIS_URL env file was loaded from disk")
        return env_var_value
    
    env_var_value = parse_dotenv_for_var('JSINFO_QUERY_REDDIS_CACHE')
    if env_var_value:
        log("get_reddis_server", "The JSINFO_QUERY_REDDIS_CACHE env file was loaded from disk")
        return env_var_value

    raise Exception("missing reddis url config JSINFO_HEALTHPROBEJOB_REDIS_URL or JSINFO_QUERY_REDDIS_CACHE in env or .env file")

REDIS_SERVER = get_reddis_server()

