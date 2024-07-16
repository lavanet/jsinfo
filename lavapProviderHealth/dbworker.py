import json, threading, time, queue, traceback
from datetime import datetime
from datetime import timezone
from typing import Any
from utils import log, error, safe_json_dump, exit_script, is_health_status_better, replace_for_compare, convert_dict_to_dbjson
from env import GEO_LOCATION
from database import db_cur_fetchone, db_execute_operation, db_execute_operation_nolog, db_reconnect

# Global queue for provider health data
db_task_queue = queue.Queue()
db_queue_condition = threading.Condition()

def db_save_data_to_queue(data: Any) -> None:
    data_to_send_to_server = safe_json_dump(data)
    # log("db_save_data_to_queue", data_to_send_to_server)

    for _ in range(20):
        if db_queue_condition.acquire(timeout=30): 
            try:
                db_task_queue.put(data_to_send_to_server)
                db_queue_condition.release()
                return
            except Exception as e:
                db_queue_condition.release()
                error("db_save_data_to_queue", "Error while adding data to queue: ", e)
        else:
            log("db_save_data_to_queue", "Waited for 30 seconds but condition was not notified")

    log("db_save_data_to_queue", "Retry limit exceeded")
    if db_task_queue.empty():
        log("db_save_data_to_queue", "Queue is empty, exiting script")
        exit_script()

def db_add_provider_health_data(guid: str, provider_id: str, spec: str, apiinterface: str, status: str, data: Any) -> None:
    global db_task_queue, db_queue_condition
    db_save_data_to_queue({
        'type': 'health',
        'guid': guid,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'provider_id': provider_id,
        'spec': spec,
        'apiinterface': apiinterface,
        'status': status,
        'data': convert_dict_to_dbjson(data)
    })

def db_add_accountinfo_data(provider_id: str, data: Any) -> None:
    global db_task_queue, db_queue_condition
    db_save_data_to_queue({
        'type': 'accountinfo',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'provider_id': provider_id,
        'data': convert_dict_to_dbjson(data)
    })

def db_worker_work():
    global db_queue_condition, db_task_queue

    item = None
    if db_queue_condition.acquire(timeout=30):
        # log("db_worker_work", "Acquired queue condition lock")
        try:
            try:
                item = db_task_queue.get_nowait()
            except queue.Empty:
                # log("db_worker_work", "Queue is empty")
                pass
        finally:
            # log("db_worker_work", "Released queue condition lock")
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
    elif data["type"] == "subscriptionlist":
        db_add_subscription_list_data(data)
    else:
        log("db_worker_work", f"Unknown data type: {data['type']}")
        exit_script()

# CREATE TABLE IF NOT EXISTS "provider_accountinfo" (
# 	"id" serial PRIMARY KEY NOT NULL,
# 	"provider" text,
# 	"timestamp" timestamp NOT NULL,
# 	"data" varchar(5000) DEFAULT NULL
# );
def db_worker_work_accountinfo(data):
    log("db_worker_work_accountinfo", f"Processing item: {data}")
    ret = db_execute_operation_nolog("""
        SELECT data, timestamp FROM provider_accountinfo WHERE provider = %s ORDER BY timestamp DESC LIMIT 1
    """, (data['provider_id'],))
    if ret is False:
        return
    result = db_cur_fetchone()
    if result is not None:
        existing_data = result[0]
        new_data = data['data']
        if replace_for_compare(existing_data) == replace_for_compare(new_data):
            # If data is the same, update the timestamp of the existing record
            db_execute_operation("""
                UPDATE provider_accountinfo SET timestamp = %s WHERE provider = %s
            """, (data['timestamp'], data['provider_id']))
            log("db_worker_work_accountinfo", "Data is the same - timestamp updated for existing record")
        else:
            # If data is different, insert a new record
            db_execute_operation("""
                INSERT INTO provider_accountinfo (provider, timestamp, data)
                VALUES (%s, %s, %s)
            """, (data['provider_id'], data['timestamp'], data['data']))
            log("db_worker_work_accountinfo", "New record inserted")
    else:
        # If no existing record, insert a new one
        db_execute_operation("""
            INSERT INTO provider_accountinfo (provider, timestamp, data)
            VALUES (%s, %s, %s)
        """, (data['provider_id'], data['timestamp'], data['data']))
        log("db_worker_work_accountinfo", "New record inserted because no existing data was found")

verified_specs = set()

def db_worker_work_provider_spec_moniker(data):
    if not all(key in data for key in ['provider', 'moniker', 'spec']):
        log("db_worker_work_provider_spec_moniker", "Invalid data format")
        return
    log("db_worker_work_provider_spec_moniker", f"Processing item: {data}")

    # Ensure spec exists in specs table
    if data['spec'] not in verified_specs:
        # Attempt to insert spec into specs table
        ret = db_execute_operation_nolog("""
            INSERT INTO specs (id)
            VALUES (%s)
            ON CONFLICT (id) DO NOTHING
        """, (data['spec'],))
        if ret is False:
            error("db_worker_work_provider_spec_moniker", "Error ensuring spec exists")
            return
        # Add spec to global set after successful check or insert
        verified_specs.add(data['spec'])
    
    # UPSERT operation (Insert or Update on Conflict)
    ret = db_execute_operation_nolog("""
        INSERT INTO provider_spec_moniker (provider, moniker, spec)
        VALUES (%s, %s, %s)
        ON CONFLICT (provider, spec) DO UPDATE
        SET moniker = EXCLUDED.moniker
    """, (data['provider'], data['moniker'], data['spec']))
    
    if ret is False:
        error("db_worker_work_provider_spec_moniker", "Error in UPSERT operation")
    else:
        log("db_worker_work_provider_spec_moniker", "Record inserted or updated successfully")

def db_worker_work_health(data):
    log("db_worker_work_health", f"Processing item: {data}")
    ret = db_execute_operation_nolog("""
        SELECT status, data FROM provider_health WHERE provider = %s AND guid = %s AND spec = %s AND interface = %s AND geolocation = %s
    """, (data['provider_id'], data['guid'], data['spec'], data['apiinterface'], GEO_LOCATION))
    if ret is False:
        return
    result = db_cur_fetchone()
    if result is None:
        log("db_worker_work_health", f"No existing record found, inserting new record for provider {data['provider_id']}, GUID: {data['guid']}, Spec: {data['spec']}, API Interface: {data['apiinterface']}")
        db_execute_operation_nolog("""
            INSERT INTO provider_health (provider, timestamp, guid, spec, geolocation, interface, status, data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (data['provider_id'], data['timestamp'], data['guid'], data['spec'], GEO_LOCATION, data['apiinterface'], data['status'], data['data']))
    else:
        old_status, old_data = result
        if is_health_status_better(old_status, data['status'], old_data, data['data']):
            log("db_worker_work_health", f"Updating status from {old_status} to {data['status']} for provider {data['provider_id']}, GUID: {data['guid']}, Spec: {data['spec']}, API Interface: {data['apiinterface']}")
            db_execute_operation("""
                UPDATE provider_health SET status = %s, data = %s WHERE provider = %s AND guid = %s AND spec = %s AND interface = %s AND geolocation = %s
            """, (data['status'], data['data'], data['provider_id'], data['guid'], data['spec'], data['apiinterface'], GEO_LOCATION))
        else:
            log("db_worker_work_health", f"Updating timestamp for provider {data['provider_id']}, GUID: {data['guid']}, Spec: {data['spec']}, API Interface: {data['apiinterface']}")
            db_execute_operation("""
                UPDATE provider_health SET timestamp = NOW() WHERE provider = %s AND guid = %s AND spec = %s AND interface = %s AND geolocation = %s
            """, (data['provider_id'], data['guid'], data['spec'], data['apiinterface'], GEO_LOCATION))
    db_task_queue.task_done()

verified_consumers = set()

def db_worker_work_subscriptionlist(data):
    global verified_consumers

    data = safe_json_dump(data["data"])

    log("db_worker_work_subscriptionlist", f"Processing item: {data}")

     # Ensure consumer exists in consumers table
    if data['consumer'] not in verified_consumers:
        # Attempt to insert consumer into consumers table
        db_execute_operation("""
            INSERT INTO consumers (address)
            VALUES (%s)
            ON CONFLICT (address) DO NOTHING
        """, (data['consumer'],))
        # Add consumer to global set
        verified_consumers.add(data['consumer'])

    ret = db_execute_operation("""
        SELECT fulltext FROM consumer_subscription_list WHERE consumer = %s ORDER BY createdat DESC LIMIT 1
    """, (data['consumer'],))
    if ret is False:
        return
    result = db_cur_fetchone()
    insert_new_entry = False
    if result is None:
        insert_new_entry = True
    else:
        existing_data = result[0]
        new_data = data
        if replace_for_compare(existing_data) != replace_for_compare(new_data):
            insert_new_entry = True

    if insert_new_entry:
        # If no existing record, insert a new one
        db_execute_operation("""
            INSERT INTO consumer_subscription_list (consumer, plan, fulltext)
            VALUES (%s, %s, %s)
        """, (data['consumer'], data['plan'], convert_dict_to_dbjson(data)))
        log("db_worker_work_subscriptionlist", "New record inserted because no existing data was found")

def db_add_subscription_list_data(data: Any) -> None:
    global db_task_queue, db_queue_condition
    db_save_data_to_queue({
        'type': 'subscriptionlist',
        'consumer': data["consumer"],
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'data': convert_dict_to_dbjson(data)
    })

def db_worker_thread():
    log("db_worker", "Starting worker")
    db_reconnect()
    while True:
        # log("db_worker", "Checking if queue is empty")
        if db_task_queue.empty():
            # log("db_worker", "Queue is empty, sleeping for 10 seconds")
            time.sleep(10)
        # log("db_worker", "Starting work loop")
        for i in range(3):
            try:
                if i > 0:
                    log("db_worker", f"Attempt {i+1}")
                db_worker_work()
                break
            except Exception as e:
                error("db_worker", f"Error in attempt {i+1}: {e}, \nStack Trace: {traceback.format_exc()}")
                error("db_worker", "Sleeping for 1 second and reconnecting")
                time.sleep(1)
                db_reconnect()

def start_db_worker():
    threading.Thread(target=db_worker_thread, name="db_worker").start()
