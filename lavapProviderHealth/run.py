#!/usr/bin/env python3

import sys, re, os, requests, subprocess, json, threading, shlex, string, time, random, queue, psycopg2, traceback
from datetime import datetime
from datetime import timezone
from dateutil.parser import parse as parse_date
from dateutil.relativedelta import relativedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Dict, List, Optional, Any
from pathlib import Path

def log(function: str, content: str) -> None:
    timestamp: str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    trimmed_content = content[:2000] + ' ...' if len(content) > 2000 else content
    print(f"[{timestamp}] HealthProbePyLog [{threading.current_thread().name}] :: {function} :: {trimmed_content}")

def get_env_var(name, default):
    value = os.environ.get(name, default)
    if value == default:
        log("env_vars", f"{name} is set to default {value}")
    else:
        log("env_vars", f"{name} is set to {value}")
    return value

def parse_dotenv_for_var(var_name):
    current_dir = Path(__file__).parent
    parent_dir = current_dir.parent

    dotenv_path = current_dir / '.env'
    if not dotenv_path.exists():
        dotenv_path = parent_dir / '.env'

    if dotenv_path.exists():
        with open(dotenv_path, 'r') as file:
            for line in file:
                if line.startswith(var_name):
                    return line.strip().split('=', 1)[1]
    return None

# Constants
POSTGRES_URL = os.environ.get('JSINFO_HEALTHPROBEJOB_POSTGRESQL_URL', 'postgres://jsinfo:secret@localhost:5432/jsinfo')
PROVIDERS_URL: str = get_env_var('JSINFO_HEALTHPROBEJOB_PROVIDERS_URL', "https://jsinfo.lavanet.xyz/providers")
NODE_URL: str = get_env_var('JSINFO_HEALTHPROBEJOB_NODE_URL', "https://public-rpc.lavanet.xyz:443")
HPLAWNS_FILENAME: str = get_env_var('JSINFO_HEALTHPROBEJOB_HPLAWNS_FILENAME', os.path.expanduser("~/tmp/health_probe_lava_addresses_with_no_specs.json"))
HPLAWNS_FILENAME = os.path.abspath(HPLAWNS_FILENAME)
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
    log("update_guid (start)", "new HEALTH_RESULTS_GUID: " + HEALTH_RESULTS_GUID)
    counter = 0
    while True:
        HEALTH_RESULTS_GUID = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        counter += 1
        log("update_guid (loop)", "new HEALTH_RESULTS_GUID: " + HEALTH_RESULTS_GUID + ", loop count: " + str(counter))
        time.sleep(15 * 60)
        
threading.Thread(target=update_guid).start()

log('main', 'health_probe_lava_addresses_with_no_specs path is:\n' + HPLAWNS_FILENAME)

def exit_script() -> None:
    log("exit_script", "Exiting script")
    os._exit(1)
    
# Global queue for provider health data
db_provider_health_queue = queue.Queue()
db_queue_condition = threading.Condition()

def db_save_data_to_queue(data: Any) -> None:
    data_to_send_to_server = safe_json_dump(data)
    log("db_save_data_to_queue", data_to_send_to_server)

    for _ in range(20):
        if db_queue_condition.acquire(timeout=30): 
            try:
                db_provider_health_queue.put(data_to_send_to_server)
                db_queue_condition.release()
                return
            except Exception as e:
                db_queue_condition.release()
                log("db_save_data_to_queue", "Error while adding data to queue: ", e)
        else:
            log("db_save_data_to_queue", "Waited for 30 seconds but condition was not notified")

    log("db_save_data_to_queue", "Retry limit exceeded")
    if db_provider_health_queue.empty():
        log("db_save_data_to_queue", "Queue is empty, exiting script")
        exit_script()

def db_json_data(data):
    if (type(data) == str and data.strip() == "") or str(data).strip() in ["{}","", "[]", "\"\"", "null", "None"]:
        return ""
    elif type(data) != str:
        return safe_json_dump(data, slim=True)
    return data

def db_add_provider_health_data(guid: str, provider_id: str, spec: str, apiinterface: str, status: str, data: Any) -> None:
    global db_provider_health_queue, db_queue_condition
    db_save_data_to_queue({
        'type': 'health',
        'guid': guid,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'provider_id': provider_id,
        'spec': spec,
        'apiinterface': apiinterface,
        'status': status,
        'data': db_json_data(data)
    })


def db_add_accountinfo_data(provider_id: str, data: Any) -> None:
    global db_provider_health_queue, db_queue_condition
    db_save_data_to_queue({
        'type': 'accountinfo',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'provider_id': provider_id,
        'data': db_json_data(data)
    })

# Status rankings
STATUS_RANKINGS = {
    'healthy': 4,
    'jailed': 3,
    'unstaked': 2,
    'frozen': 1
}

def is_status_better(old_status: str, new_status: str, old_data: str, new_data: str) -> bool:
    old_rank = STATUS_RANKINGS.get(old_status, 0)
    new_rank = STATUS_RANKINGS.get(new_status, 0)

    if new_rank > old_rank:
        return True
    elif new_rank < old_rank:
        return False
    
    old_data_json = safe_load_json_or_none(old_data)
    new_data_json = safe_load_json_or_none(new_data)

    if old_data_json == None and new_data_json == None:
        return False
    if old_data_json is None and new_data_json != None:
        return True
    elif old_data_json != None and new_data_json == None:
        return False
    
    old_block = old_data_json.get('block', 0)
    new_block = new_data_json.get('block', 0)

    if new_block > old_block:
        return True
    
    old_others = old_data_json.get('others', 0)
    new_others = new_data_json.get('others', 0)

    if new_others > old_others:
        return True
    
    old_latency = old_data_json.get('latency', 0)
    new_latency = new_data_json.get('latency', 0)

    if (new_latency < old_latency and new_latency != 0) or (old_latency == 0 and new_latency > 0):
        return True
    
    if len(new_data) > len(old_data):
        return True
    
    return False

db_conn = psycopg2.connect(POSTGRES_URL)
db_cur = db_conn.cursor()

def db_reconnect():
    global db_conn, db_cur
    db_conn = psycopg2.connect(POSTGRES_URL)
    db_cur = db_conn.cursor()

def execute_db_operation(query, params, retries=3):
    global db_conn, db_cur
    for i in range(retries):
        try:
            log("execute_db_operation", f"Executing query: {query} with params: {params}")
            db_cur.execute(query, params)
            db_conn.commit()
            log("execute_db_operation", "Query executed successfully")
            return True
        except Exception as e:
            log("execute_db_operation", f"Error executing DB operation: {e}")
            time.sleep(1)
            db_reconnect()
    return False

def db_worker_work():
    global db_conn, db_cur, db_queue_condition, db_provider_health_queue

    item = None
    if db_queue_condition.acquire(timeout=30):
        log("db_worker_work", "Acquired queue condition lock")
        try:
            try:
                item = db_provider_health_queue.get_nowait()
            except queue.Empty:
                log("db_worker_work", "Queue is empty")
        finally:
            log("db_worker_work", "Released queue condition lock")
            db_queue_condition.release()

    if item is None:
        log("db_worker_work", "No item found in queue - sleeping for 60 seconds")
        time.sleep(60)
        return

    data = json.loads(item)
    if data["type"] == "health":
        db_worker_work_health(data)
    elif data["type"] == "accountinfo":
        db_worker_work_accountinfo(data)
    else:
        log("db_worker_work", f"Unknown data type: {data['type']}")
        exit_script()

def replace_for_compare(data):
    return str(data).replace(" ", "").replace("\t", "").replace("\n", "").lower()

# CREATE TABLE IF NOT EXISTS "provider_accountinfo" (
# 	"id" serial PRIMARY KEY NOT NULL,
# 	"provider" text,
# 	"timestamp" timestamp NOT NULL,
# 	"data" varchar(5000) DEFAULT NULL
# );
def db_worker_work_accountinfo(data):
    log("db_worker_work_accountinfo", f"Processing item: {data}")
    execute_db_operation("""
        SELECT data, timestamp FROM provider_accountinfo WHERE provider = %s ORDER BY timestamp DESC LIMIT 1
    """, (data['provider_id'],))
    result = db_cur.fetchone()
    if result is not None:
        existing_data = result[0].replace(" ", "").replace("\t", "").replace("\n", "").lower()
        new_data = data['data'].replace(" ", "").replace("\t", "").replace("\n", "").lower()
        if replace_for_compare(existing_data) == replace_for_compare(new_data):
            # If data is the same, update the timestamp of the existing record
            execute_db_operation("""
                UPDATE provider_accountinfo SET timestamp = %s WHERE provider = %s
            """, (data['timestamp'], data['provider_id']))
            log("db_worker_work_accountinfo", "Data is the same - timestamp updated for existing record")
        else:
            # If data is different, insert a new record
            execute_db_operation("""
                INSERT INTO provider_accountinfo (provider, timestamp, data)
                VALUES (%s, %s, %s)
            """, (data['provider_id'], data['timestamp'], data['data']))
            log("db_worker_work_accountinfo", "New record inserted")
    else:
        # If no existing record, insert a new one
        execute_db_operation("""
            INSERT INTO provider_accountinfo (provider, timestamp, data)
            VALUES (%s, %s, %s)
        """, (data['provider_id'], data['timestamp'], data['data']))
        log("db_worker_work_accountinfo", "New record inserted because no existing data was found")

def db_worker_work_health(data):
    log("db_worker_work_health", f"Processing item: {data}")
    execute_db_operation("""
        SELECT status, data FROM provider_health WHERE provider = %s AND guid = %s AND spec = %s AND interface = %s AND geolocation = %s
    """, (data['provider_id'], data['guid'], data['spec'], data['apiinterface'], GEO_LOCATION))
    result = db_cur.fetchone()
    if result is None:
        log("db_worker_work_health", f"No existing record found, inserting new record for provider {data['provider_id']}, GUID: {data['guid']}, Spec: {data['spec']}, API Interface: {data['apiinterface']}")
        execute_db_operation("""
            INSERT INTO provider_health (provider, timestamp, guid, spec, geolocation, interface, status, data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (data['provider_id'], data['timestamp'], data['guid'], data['spec'], GEO_LOCATION, data['apiinterface'], data['status'], data['data']))
    else:
        old_status, old_data = result
        if is_status_better(old_status, data['status'], old_data, data['data']):
            log("db_worker_work_health", f"Updating status from {old_status} to {data['status']} for provider {data['provider_id']}, GUID: {data['guid']}, Spec: {data['spec']}, API Interface: {data['apiinterface']}")
            execute_db_operation("""
                UPDATE provider_health SET status = %s, data = %s WHERE provider = %s AND guid = %s AND spec = %s AND interface = %s AND geolocation = %s
            """, (data['status'], data['data'], data['provider_id'], data['guid'], data['spec'], data['apiinterface'], GEO_LOCATION))
        else:
            log("db_worker_work_health", f"Updating timestamp for provider {data['provider_id']}, GUID: {data['guid']}, Spec: {data['spec']}, API Interface: {data['apiinterface']}")
            execute_db_operation("""
                UPDATE provider_health SET timestamp = NOW() WHERE provider = %s AND guid = %s AND spec = %s AND interface = %s AND geolocation = %s
            """, (data['provider_id'], data['guid'], data['spec'], data['apiinterface'], GEO_LOCATION))
    db_provider_health_queue.task_done()

def db_worker():
    log("db_worker", "Starting worker")
    db_reconnect()
    while True:
        log("db_worker", "Checking if queue is empty")
        if db_provider_health_queue.empty():
            log("db_worker", "Queue is empty, sleeping for 10 seconds")
            time.sleep(10)
        log("db_worker", "Starting work loop")
        for i in range(3):
            try:
                log("db_worker", f"Attempt {i+1}")
                db_worker_work()
                break
            except Exception as e:
                log("db_worker", f"Error in attempt {i+1}: {e}, \nStack Trace: {traceback.format_exc()}")
                log("db_worker", "Sleeping for 1 second and reconnecting")
                time.sleep(1)
                db_reconnect()

# Start the worker function in a new thread
threading.Thread(target=db_worker, name="db_worker").start()

def run_command(command: str, print_stdout: bool = True, timeout: int = 120) -> str:
    for attempt in range(10):
        log('run_command', f"Running command . attempt {attempt}. command:\n{command}")
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, text=True)

        def monitor() -> None:
            if process.poll() is None:
                log('run_command', "Command timed out")
                process.terminate()

        timer = threading.Timer(timeout, monitor)
        timer.start()

        stdout_lines: List[str] = []

        while True:
            stdout_line: str = process.stdout.readline()
            if stdout_line == '' and process.poll() is not None:
                break
            stdout_lines.append(stdout_line)
            if stdout_line and print_stdout:
                log('run_command stdout', stdout_line.strip())

        timer.cancel()

        stderr: str = process.stderr.read()
        if stderr:
            log('run_command stderr', str(stderr).strip())
            if any(error in stderr for error in ["character 'e' looking for beginning of value", "Many Requests", "--from string        Name or address of private key with which to sign"]):
                log('run_command', f"Encountered error in attempt {attempt + 1}, retrying after delay...")
                time.sleep(random.randint(30, 60))  # sleep for random time between 30s to 1 minute
                continue  # retry the command

        stdout_line = process.stdout.read()
        if stdout_line:
            stdout_lines.append(stdout_line)
            if print_stdout:
                log('run_command stdout', stdout_line.strip())

        return ''.join(stdout_lines)

    log('run_command', "All attempts failed, exiting...")
    exit_script()

def safe_json_load(obj: str, print_error: bool = True) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(obj)
    except Exception:
        if print_error:
            log("safe_json_dump", f"Failed to load json, Obj of type {type(obj)}:\n{obj}")
        return None

def safe_load_json_or_none(obj: str) -> Dict[str, Any] | None:
    if str(obj).strip().lower() in ["{}","", "[]", "\"\"", "null", "none"]:
        return None
    try:
        ret = safe_json_load(obj, print_error=False)
        if str(ret).strip().lower() in ["{}","", "[]", "\"\"", "null", "none"]:
            return None
        return ret
    except Exception:
        return None
    
def safe_json_dump(obj: Any, slim: bool = False) -> str:
    try:
        if slim:
            return json.dumps(obj, separators=(',', ':'), default=str)
        else:
            return json.dumps(obj, indent=4, default=str)
    except Exception:
        return "Json Parsing Error, Original Data:\n" + str(obj)

def haplawns_read_addresses_from_file() -> Dict[str, str]:
    if os.path.exists(HPLAWNS_FILENAME):
        with open(HPLAWNS_FILENAME, 'r') as f:
            ret = safe_json_load(f.read(), print_error=True)
            if ret in [None, {}]:
                os.remove(HPLAWNS_FILENAME)
                return {}
            return ret
    else:
        return {}

def haplawns_write_address_to_file(address: str) -> None:
    addresses = haplawns_read_addresses_from_file()
    addresses[address] = (datetime.now(timezone.utc) + HPLAWNS_QUERY_INTERVAL).isoformat()
    with open(HPLAWNS_FILENAME, 'w') as f:
        json.dump(addresses, f)

def replace_archive(input_string: str) -> str:
    while '"archive","archive"' in input_string:
        input_string = input_string.replace('"archive","archive"', '"archive"')
    return input_string

def run_accountinfo_command(address: str) -> Optional[Dict[str, Any]]:
    command = f"lavad q pairing account-info {address} --output json --node {NODE_URL}"
    output = run_command(command, print_stdout=DEBUG_PRINT_ACCOUNT_INFO_STDOUT)
    log('run_accountinfo_command', 'Pairing command completed.')
    return safe_json_load(replace_archive(output))

def parse_accountinfo_spec(result: Dict[str, Dict[str, List[str]]], key: str, provider: Dict[str, Any]) -> None:
    if provider is None:
        log("parse_accountinfo_spec", f"Error: Provider is None. Key: {key}, Provider: {provider}")
        return
    chain: str = provider.get('chain', '')
    if len(chain) < 2:
        log("parse_accountinfo_spec", f"Error: Chain is less than 2 characters. Chain: {chain}, Key: {key}, Provider: {provider}")
        return
    endpoints: List[Dict[str, Any]] = provider.get('endpoints', [])
    for endpoint in endpoints:
        api_interfaces: List[str] = endpoint.get('api_interfaces', [])
        if len(api_interfaces) == 0:
            log("parse_accountinfo_spec", f"Error: Api Interfaces count is 0. Chain: {chain}, Key: {key}, Provider: {provider}, Api Interfaces: {api_interfaces}")
            return
        if chain not in result[key]:
            result[key][chain] = []
        for interface in api_interfaces:
            if interface not in result[key][chain]:
                result[key][chain].append((interface, ""))
            
            # from the docs:
            # https://github.com/lavanet/lava/blob/6249399121690effe2b12cc3adc1d099c343235c/x/pairing/README.md#L220
            # if I have a provider with jails > 2 and jail_end_time < date.now()  provider status should be frozen with a message of run to unfreeze: lavad tx pairing unfreeze CHAINID
            # otherwise if jails > 0 || jail_end_time I consider the provider jailed
            jail_end_time = provider.get("jail_end_time", "0")
            if jail_end_time == "1970-01-01 00:00:00":
                jail_end_time = "0"
            jails = int(provider.get("jails", "0"))
            if jail_end_time != "0" or jails != 0:
                if parse_date_to_utc(jail_end_time) > datetime.now(timezone.utc) and jails > 2:
                    if chain not in result["frozen"]:
                        result["frozen"][chain] = []
                    result["frozen"][chain].append((interface, {"message": "run to unfreeze: lavad tx pairing unfreeze " + chain}))
                else:
                    if chain not in result["jailed"]:
                        result["jailed"][chain] = []
                    result["jailed"][chain].append((interface, {"jail_end_time": jail_end_time, "jails": jails}))

def parse_accountinfo_command(output: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
    result: Dict[str, Dict[str, List[str]]] = {"healthy": {}, "unstaked": {}, "frozen": {}, "jailed": {}}
    healthy: List[Dict[str, Any]] = output.get('provider', [])
    frozen: List[Dict[str, Any]] = output.get('frozen', [])
    unstaked: List[Dict[str, Any]] = output.get('unstaked', [])
    for provider in healthy:
        parse_accountinfo_spec(result, "healthy", provider)
    for provider in frozen:
        parse_accountinfo_spec(result, "frozen", provider)
    for provider in unstaked:
        parse_accountinfo_spec(result, "unstaked", provider)
    log('parse_accountinfo_command', "Result:\n" + safe_json_dump(result)) 
    return result

def run_health_command(address: str, single_provider_specs_interfaces_data: Optional[Dict[str, List[str]]] = None) -> None:
    log('run_health_command', f'Starting health command for address: {address}')
    command = f"lavap test health health_all_providers.yml --node {NODE_URL} --single-provider-address {address} --post-results-guid {HEALTH_RESULTS_GUID} --run-once-and-exit --post-results-skip-spec"
    if single_provider_specs_interfaces_data is not None:
        transformed_data = {provider: [interface[0] for interface in interfaces] 
                    for provider, interfaces in single_provider_specs_interfaces_data.items()}
        command += " --single-provider-specs-interfaces-data " + shlex.quote(json.dumps(transformed_data))
    run_command(command)
    log('run_health_command', 'Health command completed.')

def parse_date_to_utc(dt):
    if isinstance(dt, int) or (isinstance(dt, str) and dt.isdigit()):
        dt = datetime.fromtimestamp(int(dt), timezone.utc)
    elif isinstance(dt, str):
        dt = parse_date(dt)
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

def get_provider_addresses() -> List[str]:
    log('get_provider_addresses', 'Fetching provider addresses...')
    response = requests.get(PROVIDERS_URL)
    providers: List[Dict[str, Any]] = response.json()['providers']
    addresses: List[str] = []
    next_query_times: Dict[str, str] = haplawns_read_addresses_from_file()
    for provider in providers:
        address: str = provider['address']
        next_query_time: Optional[str] = next_query_times.get(address, None)
        if next_query_time is None or parse_date_to_utc(next_query_time) <= datetime.now(timezone.utc):
            addresses.append(address)
    log('get_provider_addresses', f'Fetched {len(addresses)} provider addresses.')
    return addresses

def process_lava_id_address(address: str) -> None:
    log("process_lava_id_address", 'Checking account info & health for provider: ' + address)

    info_command_raw_json: Optional[Dict[str, Any]] = run_accountinfo_command(address)
    if info_command_raw_json is None:
        log("process_lava_id_address", 'Failed parsing account info output for: ' + address + '. Skipping...')
        return
    
    db_add_accountinfo_data(address, info_command_raw_json)

    info_command_parsed_json: Dict[str, Dict[str, List[str]]] = parse_accountinfo_command(info_command_raw_json)
    if all(len(info_command_parsed_json[key]) == 0 for key in ['healthy', 'unstaked', 'frozen']):
        log("process_lava_id_address", 'Provider has no spec data: ' + address)
        haplawns_write_address_to_file(address)
        return

    if len(info_command_parsed_json["healthy"]) > 0:
        run_health_command(address, single_provider_specs_interfaces_data = info_command_parsed_json["healthy"])

    for spec, api_interfaces in info_command_parsed_json["frozen"].items():
        for api_interface, data in api_interfaces:
            db_add_provider_health_data(HEALTH_RESULTS_GUID, address, spec, api_interface, "frozen", data)
    
    for spec, api_interfaces in info_command_parsed_json["unstaked"].items():
        for api_interface, data in api_interfaces:
            db_add_provider_health_data(HEALTH_RESULTS_GUID, address, spec, api_interface, "unstaked", data)
    
    for spec, api_interfaces_and_data in info_command_parsed_json["jailed"].items():
        for api_interface, data in api_interfaces_and_data:
            db_add_provider_health_data(HEALTH_RESULTS_GUID, address, spec, api_interface, "jailed", data)

def process_batch(batch):
    while True:
        log("process_batch", "Starting new loop")
        for address in batch:
            if not address:
                continue
            try:
                log("process_batch", f"Processing address: {address}")
                process_lava_id_address(address)
                log("process_batch", f"Successfully processed address: {address}")
            except Exception as e:
                log("process_batch", f"Error processing address: {address}. Error: {str(e)}\nStack Trace: {traceback.format_exc()}")
        log("process_batch", "Finished loop")

def main(lava_id = None) -> None:
    os.chdir(os.path.expanduser(CD_ON_START))

    server_thread = threading.Thread(target=run_server, name="http_server")
    server_thread.start()

    if lava_id:
        log("main - one provider mode", f"Processing address: {lava_id}")
        process_lava_id_address(lava_id)
        log("main - one provider mode", f"Successfully processed address: {lava_id}")
        exit_script()
    
    addresses = get_provider_addresses()

    batch_size = len(addresses) // BATCH_AMOUNT

    batches = [addresses[i:i + batch_size] for i in range(0, len(addresses), batch_size)]

    threads = []
    for batch_idx, batch in enumerate(batches):
        batch_thread = threading.Thread(target=process_batch, args=(batch,), name="batch_thread%02d" % batch_idx)
        batch_thread.start()
        threads.append(batch_thread)

        time.sleep(random.randint(1, 60))

    # Wait for all threads to finish
    for thread in threads:
        thread.join()

def fmt_unhealthy_error(msg):
    if msg.strip().lower() == "context deadline exceeded":
        return "provider query timed out"
    return msg

def parse_and_save_provider_health_status_from_request(data: Dict[str, Any], guid: str) -> List[Dict[str, Any]]:
    parsed_data: List[Dict[str, Any]] = []

    if data is None:
        log("parse_and_save_provider_health_status_from_request", "error - data is None")
        return []
    
    if 'providerData' not in data and 'unhealthyProviders' not in data and not 'latestBlocks' in data:
        log("parse_and_save_provider_health_status_from_request", "bad data:: Keys 'providerData' or 'unhealthyProviders' not found in data: " + safe_json_dump(data))
        return None
    
    processed_ids = set()

    for key, value in data.get('providerData', {}).items():
        if key in processed_ids:
            continue
        processed_ids.add(key)

        provider_id, spec, apiinterface = key.strip('"').split(' | ')

        if data['latestBlocks'][spec] == 0:
            msg = data.get('unhealthyProviders', {}).get(key, "lateset block request failed for spec")
            msg = fmt_unhealthy_error(msg)
            db_add_provider_health_data(guid, provider_id, spec, apiinterface, "unhealthy", {"message": msg})
        if value['block'] == 0:
            msg = data.get('unhealthyProviders', {}).get(key, "lateset block request failed on provider side")
            msg = fmt_unhealthy_error(msg)
            db_add_provider_health_data(guid, provider_id, spec, apiinterface, "unhealthy", {"message": msg})
        else:
            health_data = {
                'block': value['block'],
                'others': data['latestBlocks'][spec],
                'latency': value['latency'],
            }

            db_add_provider_health_data(guid, provider_id, spec, apiinterface, "healthy", health_data)

    for key, value in data.get('unhealthyProviders', {}).items():
        if key in processed_ids:
            continue
        processed_ids.add(key)
                
        provider_id, spec, apiinterface = key.strip('"').split(' | ')

        if value.strip() != "":
            value = {"message": fmt_unhealthy_error(value)}
        else:
            value = ""
        db_add_provider_health_data(guid, provider_id, spec, apiinterface, "unhealthy", value)


    for key, value in data.get('frozenProviders', {}).items():
        if key in processed_ids:
            continue
        processed_ids.add(key)
            
        provider_id, spec, apiinterface = key.strip('"').split(' | ')

        db_add_provider_health_data(guid, provider_id, spec, apiinterface, "frozen", "")

    return parsed_data
    
class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        content_length: int = int(self.headers['Content-Length'])
        post_data: bytes = self.rfile.read(content_length)
        data: Optional[Dict[str, Any]] = safe_json_load(post_data.decode('utf-8'))

        if data != None:
            guid: Optional[str] = data.get('resultsGUID',"")
            if guid.strip() == "":
                log("http_server_post", "Missing 'resultsGUID' in the received data")
            else:
                parse_and_save_provider_health_status_from_request(data, guid)

        # Send a 200 OK response
        self.send_response(200)
        self.end_headers()

def run_server() -> None:
    try:
        httpd = HTTPServer(HTTP_SERVER_ADDRESS, RequestHandler)
        log("run_server", 'Server running on ' + HTTP_SERVER_ADDRESS[0] + ':' + str(HTTP_SERVER_ADDRESS[1]))
        httpd.serve_forever()
    except Exception as e:
        log("run_server", f"Server failed with error: {e}")
        exit_script()

def print_help():
    print("Usage: run.py [lava_id?]")
    print("lava_id should be in the format: lava@<id>")
    print("Example: run.py lava@1uhnqhw75xyu4kxj7lqhenlnl8kw62x263tmt8h")
    exit_script()

def is_valid_lava_id(lava_id):
    return re.match(r"^lava@[0-9a-zA-Z]+$", lava_id) is not None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] in ("-h", "--help"):
            print_help()
        lava_id = sys.argv[1]
        if not is_valid_lava_id(lava_id):
            print("Error: Invalid lava_id format.")
            print_help()
    else:
        lava_id = None

    main(lava_id)

