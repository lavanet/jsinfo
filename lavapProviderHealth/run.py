#!/usr/bin/env python3

import sys, os, threading, time, random
from env import BATCH_AMOUNT, CD_ON_START
from accountinfo import accountinfo_process_batch, accountinfo_process_lavaid, get_provider_addresses_from_jsinfoapi
from dbworker import start_db_worker
from subscriptionlist import start_subscriptionlist_index
from utils import log, exit_script, is_valid_lava_id
from server import start_http_server

def start_threads():
    start_db_worker()
    start_http_server()
    start_subscriptionlist_index()
    
def main(lava_id = None) -> None:
    os.chdir(os.path.expanduser(CD_ON_START))

    start_threads()

    if lava_id:
        start_db_worker()
        start_http_server()
        log("main - one provider mode", f"Processing address: {lava_id}")
        accountinfo_process_lavaid(lava_id)
        log("main - one provider mode", f"Successfully processed address: {lava_id}")
        exit_script()
    
    addresses = get_provider_addresses_from_jsinfoapi()

    batch_size = len(addresses) // BATCH_AMOUNT

    batches = [addresses[i:i + batch_size] for i in range(0, len(addresses), batch_size)]

    threads = []
    for batch_idx, batch in enumerate(batches):
        batch_thread = threading.Thread(target=accountinfo_process_batch, args=(batch,), name="batch_thread%02d" % batch_idx)
        batch_thread.start()
        threads.append(batch_thread)

        time.sleep(random.randint(1, 60))

    # Wait for all threads to finish
    for thread in threads:
        thread.join()

def print_help():
    print("Usage: run.py [lava_id?]")
    print("lava_id should be in the format: lava@<id>")
    print("Example: run.py lava@1uhnqhw75xyu4kxj7lqhenlnl8kw62x263tmt8h")
    exit_script()

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

