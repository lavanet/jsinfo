from datetime import datetime, timezone
import json, os, requests
import traceback
from typing import Dict, List, Optional, Any
from dbworker import db_add_accountinfo_data, db_add_provider_health_data, db_worker_work_provider_spec_moniker
from command import run_accountinfo_command, run_health_command
from utils import log, error, parse_date_to_utc, safe_json_dump, safe_json_load
from env import HEALTH_RESULTS_GUID, HPLAWNS_FILENAME, HPLAWNS_QUERY_INTERVAL, PROVIDERS_URL

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

def get_provider_addresses_from_jsinfoapi() -> List[str]:
    log('get_provider_addresses_from_jsinfoapi', 'Fetching provider addresses...')
    response = requests.get(PROVIDERS_URL)
    providers: List[Dict[str, Any]] = response.json()['providers']
    addresses: List[str] = []
    next_query_times: Dict[str, str] = haplawns_read_addresses_from_file()
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

    info_command_parsed_json: Dict[str, Dict[str, List[str]]] = parse_accountinfo_command(info_command_raw_json)
    if all(len(info_command_parsed_json[key]) == 0 for key in ['healthy', 'unstaked', 'frozen']):
        log("accountinfo_process_lavaid", 'Provider has no spec data: ' + address)
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
    log('parse_accountinfo_command', "Result:\n" + "\n".join(safe_json_dump(result).splitlines()[:10]))
    return result

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

def process_provider_spec_moniker(data):
    for keys in ["frozen", "provider", "unstaked"]:
        for item in data[keys]:
            provider_data = {
                'provider': item['address'],  
                'moniker': item['moniker'],
                'spec': item['chain'] 
            }
            db_worker_work_provider_spec_moniker(provider_data)

def accountinfo_process_batch(batch):
    while True:
        log("accountinfo_process_batch", "Starting new loop")
        for address in batch:
            if not address:
                continue
            try:
                log("accountinfo_process_batch", f"Processing address: {address}")
                accountinfo_process_lavaid(address)
                log("accountinfo_process_batch", f"Successfully processed address: {address}")
            except Exception as e:
                error("accountinfo_process_batch", f"Error processing address: {address}. Error: {str(e)}\nStack Trace: {traceback.format_exc()}")
        log("accountinfo_process_batch", "Finished loop")