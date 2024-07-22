import os, json, threading, string, time, random
from dateutil.relativedelta import relativedelta
from utils import get_env_var, log, parse_dotenv_for_var

# Constants
POSTGRES_URL = os.environ.get('JSINFO_HEALTHPROBEJOB_POSTGRESQL_URL', 'postgres://jsinfo:secret@localhost:5432/jsinfo')
PROVIDERS_URL: str = get_env_var('JSINFO_HEALTHPROBEJOB_PROVIDERS_URL', "https://jsinfo.lavanet.xyz/providers")
NODE_URL: str = get_env_var('JSINFO_HEALTHPROBEJOB_NODE_URL', "https://public-rpc.lavanet.xyz:443")

HPLAWNS_FILENAME: str = get_env_var('JSINFO_HEALTHPROBEJOB_HPLAWNS_FILENAME', os.path.expanduser("~/tmp/health_probe_lava_addresses_with_no_specs.json"))
HPLAWNS_FILENAME = os.path.abspath(HPLAWNS_FILENAME)
directory = os.path.dirname(HPLAWNS_FILENAME)
if not os.path.exists(directory):
    os.makedirs(directory)

HPLAWNS_QUERY_INTERVAL = relativedelta(days=int(get_env_var('JSINFO_HEALTHPROBEJOB_HPLAWNS_QUERY_INTERVAL', 1)))
DEBUG_PRINT_ACCOUNT_INFO_STDOUT: bool = get_env_var('JSINFO_HEALTHPROBEJOB_DEBUG_PRINT_ACCOUNT_INFO_STDOUT', 'False') == 'True'
HTTP_SERVER_ADDRESS: tuple[str, int] = tuple(json.loads(get_env_var('JSINFO_HEALTHPROBEJOB_HTTP_SERVER_ADDRESS', json.dumps(('127.0.0.1', 6500)))))
GEO_LOCATION: bool = get_env_var('JSINFO_HEALTHPROBEJOB_GEO_LOCATION', 'EU')
CD_ON_START: str = get_env_var('JSINFO_HEALTHPROBEJOB_CD_ON_START', "~/Documents/lava_projects/lava/config/health_examples")
BATCH_AMOUNT: int = get_env_var('JSINFO_HEALTHPROBEJOB_BATCH_AMOUNT', 15)

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

log('env', 'health_probe_lava_addresses_with_no_specs path is:\n' + HPLAWNS_FILENAME)
