from datetime import datetime, timezone
import json, requests
import traceback
import random
from typing import Dict, List, Optional, Any
from dbworker import db_add_accountinfo_data, db_add_provider_health_data, db_worker_work_provider_spec_moniker
from command import run_accountinfo_command, run_health_command
from utils import log, error, parse_date_to_utc, json_to_str, trim_and_limit_json_dict_size
from env import HEALTH_RESULTS_GUID, EMPTY_ACCOUNTINFO_CHECK_INTERVAL, PROVIDERS_URL
from rediscache import rediscache

REDIS_KEY = 'providers-with-empty-accountinfo'

def mark_empty_account_info_for_provider(address: str) -> None:
    addresses = rediscache.get_dict(REDIS_KEY) or {}
    addresses[address] = (datetime.now(timezone.utc) + EMPTY_ACCOUNTINFO_CHECK_INTERVAL).isoformat()
    rediscache.set_dict(REDIS_KEY, addresses, ttl=86400)  # Set TTL for 1 day

def get_provider_addresses_from_jsinfoapi() -> List[str]:
    log('get_provider_addresses_from_jsinfoapi', 'Fetching provider addresses...')
    response = requests.get(PROVIDERS_URL)
    providers: List[Dict[str, Any]] = response.json()['providers']
    addresses: List[str] = []
    next_query_times: Dict[str, str] = rediscache.get_dict(REDIS_KEY) or {}
    for provider in providers:
        address: str = provider['address']
        next_query_time: Optional[str] = next_query_times.get(address, None)
        if next_query_time is None or parse_date_to_utc(next_query_time) <= datetime.now(timezone.utc):
            addresses.append(address)
    log('get_provider_addresses_from_jsinfoapi', f'Fetched {len(addresses)} provider addresses.')
    return addresses

def accountinfo_process_lavaid(address: str) -> None:
    log("accountinfo_process_lavaid", 'Checking account info & health for provider: ' + address)

    info_command_raw_json: Optional[Dict[str, Any]] = run_accountinfo_command(address)
    if info_command_raw_json is None:
        log("accountinfo_process_lavaid", 'Failed parsing account info output for: ' + address + '. Skipping...')
        return
    
    db_add_accountinfo_data(address, info_command_raw_json)
    process_provider_spec_moniker(info_command_raw_json)

    # Attempt to retrieve cached account info
    cached_info = rediscache.get("account-info-" + address)
    if cached_info:
        info_command_raw_json = json.loads(cached_info)
    else:
        # If not in cache, run the command and cache the result
        info_command_raw_json = run_accountinfo_command(address)
        if info_command_raw_json is None:
            log("accountinfo_process_lavaid", 'Failed parsing account info output for: ' + address + '. Skipping...')
            return
        else:
            # Cache the result with a TTL of 30 minutes (1800 seconds)
            rediscache.set("account-info-" + address, json.dumps(info_command_raw_json), 1800)

    info_command_parsed_json: Dict[str, Dict[str, List[str]]] = parse_accountinfo_command(info_command_raw_json)
    if all(len(info_command_parsed_json[key]) == 0 for key in ['healthy', 'unstaked', 'frozen']):
        log("accountinfo_process_lavaid", 'Provider has no spec data: ' + address)
        mark_empty_account_info_for_provider(address)
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
    log('parse_accountinfo_command', "Result:\n" + "\n".join(json_to_str(result).splitlines()[:10]))
    return result

def parse_accountinfo_spec(result: Dict[str, Dict[str, List[str]]], key: str, provider: Dict[str, Any] | None) -> None:
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

def process_provider_spec_moniker(data):
    for keys in ["frozen", "provider", "unstaked"]:
        for item in data[keys]:
            provider_data = {
                'provider': item['address'],  
                'moniker': item['moniker'],
                'spec': item['chain'] 
            }
            db_worker_work_provider_spec_moniker(trim_and_limit_json_dict_size(provider_data))

random_number = random.randint(1, 10000)

def get_last_processed_address(batch_id):
    redis_key = f"last_processed_lavaid:{batch_id}:{random_number}"
    address = rediscache.get(redis_key)
    return address.decode("utf-8") if address else None

def set_last_processed_address(batch_id, address):
    redis_key = f"last_processed_lavaid:{batch_id}:{random_number}"
    rediscache.set(redis_key, address, 1800)

def accountinfo_process_batch(batch_idx, batch):
    last_processed_address = get_last_processed_address(batch_idx)
    start_index = 0  # Default to start from the beginning

    if last_processed_address in batch:
        calculated_index = batch.index(last_processed_address) + 1
        # Ensure start_index does not exceed the length of the batch
        start_index = calculated_index if calculated_index < len(batch) else 0
        if start_index == 0:
            log("accountinfo_process_batch", "Last processed address is the last in the batch, starting from beginning")
        else:
            log("accountinfo_process_batch", f"Resuming from last processed address {last_processed_address}")
    else:
        log("accountinfo_process_batch", "No last processed address found in batch, processing from beginning")
        start_index = random_number % len(batch)
        
    while True:
        log("accountinfo_process_batch", "Starting new loop")
        for address in batch[start_index:]:
            try:
                log("accountinfo_process_batch", f"Processing address: {address}")
                accountinfo_process_lavaid(address)
                log("accountinfo_process_batch", f"Successfully processed address: {address}")
                set_last_processed_address(batch_idx, address)
            except Exception as e:
                error("accountinfo_process_batch", f"Error processing address: {address}. Error: {str(e)}. Traceback: {traceback.format_exc()}")
        log("accountinfo_process_batch", "Finished loop")

     