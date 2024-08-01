import threading, time, traceback
from datetime import datetime
from datetime import timezone
from typing import Any
from rediscache import rediscache
from utils import log, error, json_to_str, exit_script, is_health_status_better, replace_for_compare, json_to_dbstr
from env import GEO_LOCATION
from database import db_cur_fetchone, db_execute_operation, db_execute_operation_nolog, db_reconnect

# Global queue for provider health data
REDIS_KEY="worker-queue"

def db_save_data_to_queue(data: Any) -> None:
    rediscache.lpush_dict(REDIS_KEY, data)

def db_add_provider_health_data(guid: str, provider_id: str, spec: str, apiinterface: str, status: str, data: Any) -> None:
    db_save_data_to_queue({
        'type': 'health',
        'guid': guid,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'provider_id': provider_id,
        'spec': spec,
        'apiinterface': apiinterface,
        'status': status,
        'data': json_to_dbstr(data)
    })

def db_add_accountinfo_data(provider_id: str, data: Any) -> None:
    db_save_data_to_queue({
        'type': 'accountinfo',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'provider_id': provider_id,
        'data': json_to_dbstr(data)
    })

def db_worker_work():
    data = rediscache.brpop_dict(REDIS_KEY, timeout=60)
    if data is None:
        log("db_worker_work", "No item found in queue - sleeping for 60 seconds")
        time.sleep(60)
        return

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

    if str(rediscache.get('verified_provider_' + data['provider_id'])).lower() != "valid":
        ret = db_execute_operation_nolog("""
            INSERT INTO providers (address, moniker)
            VALUES (%s, %s)
            ON CONFLICT (address) DO NOTHING
        """, (data['provider_id'], ''))
        if ret is False:
            error("db_worker_work_provider_spec_moniker", "Error ensuring provider exists")
            return
        rediscache.set('verified_provider_' + data['provider_id'], "valid", ttl=86400)  # Set TTL for 1 day
    
    ret = db_execute_operation_nolog("""
        SELECT data, timestamp FROM provider_accountinfo WHERE provider = %s ORDER BY timestamp DESC LIMIT 1
    """, (data['provider_id'],))
    if ret is False:
        return

    result = db_cur_fetchone()
    if result is not None:
        existing_data = result[0]
        new_data = data['data']
        if replace_for_compare(existing_data) != replace_for_compare(new_data):
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

def db_worker_work_provider_spec_moniker(data):
    if not all(key in data for key in ['provider', 'moniker', 'spec']):
        log("db_worker_work_provider_spec_moniker", "Invalid data format")
        return
    log("db_worker_work_provider_spec_moniker", f"Processing item: {data}")

    # Ensure provider exists in providers table
    if str(rediscache.get('verified_provider_' + data['provider'])).lower() != "valid":
        ret = db_execute_operation_nolog("""
            INSERT INTO providers (address, moniker)
            VALUES (%s, %s)
            ON CONFLICT (address) DO NOTHING
        """, (data['provider'], data['moniker']))
        if ret is False:
            error("db_worker_work_provider_spec_moniker", "Error ensuring provider exists")
            return
        rediscache.set('verified_provider_' + data['provider'], "valid", ttl=86400)  # Set TTL for 1 day

    # Ensure spec exists in specs table
    if str(rediscache.get('verified_spec_' + data['spec'])).lower() != "valid":
        ret = db_execute_operation_nolog("""
            INSERT INTO specs (id)
            VALUES (%s)
            ON CONFLICT (id) DO NOTHING
        """, (data['spec'],))
        if ret is False:
            error("db_worker_work_provider_spec_moniker", "Error ensuring spec exists")
            return
        rediscache.set('verified_spec_' + data['spec'], "valid", ttl=86400)  # Set TTL for 1 day
    
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


def db_worker_work_subscriptionlist(data):
    data = json_to_str(data["data"])

    log("db_worker_work_subscriptionlist", f"Processing item: {data}")

    # Ensure spec exists in specs table
    if str(rediscache.get('verified_consumer_' + data['consumer'])).lower() != "valid":
        ret = db_execute_operation("""
            INSERT INTO consumers (address)
            VALUES (%s)
            ON CONFLICT (address) DO NOTHING
        """, (data['consumer'],))
        if ret is False:
            error("db_worker_work_subscriptionlist", "Error ensuring consumer exists")
            return
        rediscache.set('verified_consumer_' + data['consumer'], "valid", ttl=86400)  # Set TTL for 1 day

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
        """, (data['consumer'], data['plan'], json_to_dbstr(data)))
        log("db_worker_work_subscriptionlist", "New record inserted because no existing data was found")

def db_add_subscription_list_data(data: Any) -> None:
    db_save_data_to_queue({
        'type': 'subscriptionlist',
        'consumer': data["consumer"],
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'data': json_to_dbstr(data)
    })

def db_worker_thread():
    log("db_worker", "Starting worker")
    db_reconnect()
    while True:
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
