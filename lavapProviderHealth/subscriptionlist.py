import threading, time, traceback
from dbworker import  db_add_subscription_list_data
from command import run_subscription_list_command
from utils import log, error, trim_and_limit_json_dict_size

"""
lavad q subscription list --node https://public-rpc.lavanet.xyz:443 --output json | jq
{
  "subs_info": [
    {
      "consumer": "lava@1330e5nerww5202kpfnuxurrzfz823498rm8uwl",
      "plan": "explorer",
      "duration_bought": "6",
      "duration_left": "6",
      "month_expiry": "1721159290",
      "month_cu_total": "10000000",
      "month_cu_left": "10000000",
      "cluster": "explorer_0",
      "duration_total": "0",
      "auto_renewal_next_plan": "none",
      "future_subscription": null,
      "credit": {
        "denom": "ulava",
        "amount": "30000000000"
      }
    }, ...
"""

"""
CREATE TABLE IF NOT EXISTS "consumer_subscription_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"consumer" text NOT NULL,
	"plan" text,
	"fulltext" text,
	"createdat" timestamp DEFAULT now() NOT NULL
);
"""

def subscriptionlist_index() -> None:
    subs_list_output = run_subscription_list_command()
    if subs_list_output is None:
        log('subscriptionlist_index', 'No subscription list data returned.')
        return

    subs_info_list = subs_list_output.get('subs_info', [])
    
    for subs_info in subs_info_list:
        db_add_subscription_list_data(trim_and_limit_json_dict_size(subs_info))
        # log('subscriptionlist_index', f'Processed subscription data for consumer: {subs_info.get("consumer")}')

def subscriptionlist_index_runner():
    while True:
        log('subscriptionlist_index_runner', 'Starting new iteration of subscriptionlist_index.')
        try:
            subscriptionlist_index()
        except Exception as e:
            error('subscriptionlist_index_runner', f'An exception occurred: {e}')
            traceback.print_exc()
        time.sleep(600)

def start_subscriptionlist_index():
    thread = threading.Thread(target=subscriptionlist_index_runner, daemon=True)
    thread.start()
    log('start_subscriptionlist_index', 'Subscription list index thread started.')
