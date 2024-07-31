from pathlib import Path
import re, os, json, threading
from datetime import datetime
from datetime import timezone
from dateutil.parser import parse as parse_date
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
import time

def get_env_var(name, default):
    value = os.environ.get(name, default)
    if value == default:
        log("env_vars", f"{name} is set to default {value}")
    else:
        log("env_vars", f"{name} is set to {value}")
    return value

def parse_dotenv_for_var(var_name):
    try:
        current_dir = Path(__file__).parent
        parent_dir = current_dir.parent

        dotenv_path = current_dir / '.env'
        if not dotenv_path.exists():
            log("parse_dotenv_for_var", f".env not found in {current_dir}, trying {parent_dir}")
            dotenv_path = parent_dir / '.env'

        if not dotenv_path.exists():
            return None
        
        log("parse_dotenv_for_var", f"Using .env from {dotenv_path}")
        with open(dotenv_path, 'r') as file:
            for line in file:
                if line.startswith(var_name):
                    value = line.strip().split('=', 1)[1]
                    log("parse_dotenv_for_var", f"Found {var_name} with value: {value}")
                    return value
        log("parse_dotenv_for_var", f"{var_name} not found in .env file")

    except Exception as e:
        pass
    return None

last_log_time = datetime.now(timezone.utc)

def log(function: str, content: str) -> None:
    global last_log_time
    timestamp: str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    trimmed_content = content[:2000] + ' ...' if len(content) > 2000 else content
    print(f"[{timestamp}] Log [{threading.current_thread().name}] :: {function} :: {trimmed_content}")
    last_log_time = datetime.now(timezone.utc)

def error(function: str, content: str) -> None:
    global last_log_time
    timestamp: str = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    trimmed_content = content[:2000] + ' ...' if len(content) > 2000 else content
    print(f"!! [{timestamp}] Error [{threading.current_thread().name}] :: {function} :: {trimmed_content}")
    last_log_time = datetime.now(timezone.utc)

def tick_checker():
    global last_log_time
    while True:
        time.sleep(30)  # Check every 30 seconds
        if datetime.now(timezone.utc) - last_log_time > timedelta(seconds=30):
            print(f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}] Tick")

# Start the tick checker in a background thread
tick_thread = threading.Thread(target=tick_checker, daemon=True)
tick_thread.start()

def exit_script() -> None:
    log("exit_script", "Exiting script")
    os._exit(1)

def json_load_or_none(obj: str, print_error: bool = False) -> Dict[str, Any] | None:
    if str(obj).strip().lower() in ["{}","", "[]", "\"\"", "null", "none"]:
        return None
    try:
        try:
            ret = json.loads(obj)
            if str(ret).strip().lower() in ["{}","", "[]", "\"\"", "null", "none"]:
                return None
        except Exception:
            if print_error:
                error("json_load_or_none", f"Failed to load json, Obj of type {type(obj)}:\n{obj}")
            return None
        return ret
    except Exception:
        return None
    
def json_to_str(obj: Any, slim: bool = False) -> str:
    try:
        if slim:
            return json.dumps(obj, separators=(',', ':'), default=str)
        else:
            return json.dumps(obj, indent=4, default=str)
    except Exception:
        error("json_to_str","Json Parsing Error, Original Data:\n" + str(obj))
        return ""
    
def replace_archive(input_string: str) -> str:
    while '"archive","archive"' in input_string:
        input_string = input_string.replace('"archive","archive"', '"archive"')
    return input_string

def is_valid_lavaid(lava_id):
    return re.match(r"^lava@[0-9a-zA-Z]+$", lava_id) is not None

def parse_date_to_utc(dt):
    if isinstance(dt, int) or (isinstance(dt, str) and dt.isdigit()):
        dt = datetime.fromtimestamp(int(dt), timezone.utc)
    elif isinstance(dt, str):
        dt = parse_date(dt)
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

# Status rankings
STATUS_RANKINGS = {
    'healthy': 4,
    'jailed': 3,
    'unstaked': 2,
    'frozen': 1
}

def is_health_status_better(old_status: str, new_status: str, old_data: str, new_data: str) -> bool:
    old_rank = STATUS_RANKINGS.get(old_status, 0)
    new_rank = STATUS_RANKINGS.get(new_status, 0)

    if new_rank > old_rank:
        return True
    elif new_rank < old_rank:
        return False
    
    old_data_json = json_load_or_none(old_data)
    new_data_json = json_load_or_none(new_data)

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

def replace_for_compare(data):
    # Convert data types to a uniform format before comparison
    if isinstance(data, (dict, list)):
        data = json.dumps(data, sort_keys=True)
    elif data is None:
        data = 'null'
    elif data == 0:
        data = '0'
    
    return str(data).replace(" ", "").replace("\t", "").replace("\n", "").lower()

def json_to_dbstr(data):
    if (type(data) == str and data.strip() == "") or str(data).strip() in ["{}","", "[]", "\"\"", "null", "None"]:
        return ""
    elif type(data) != str:
        return json_to_str(data, slim=True)
    return data

def trim_and_limit_json_dict_size(json_dict):
    trimmed_json_dict = {}
    for key, value in json_dict.items():
        if len(trimmed_json_dict) >= 100:
            break
        trimmed_key = key[:0x100]
        trimmed_value = str(value)[:0x1000]
        trimmed_json_dict[trimmed_key] = trimmed_value
    return trimmed_json_dict