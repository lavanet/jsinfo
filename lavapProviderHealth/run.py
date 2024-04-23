#!/usr/bin/env python3

import subprocess
import time
import argparse
import os
import threading
from datetime import datetime

JSINFO_LAVAP_PROVIDER_HEALTH_COMMAND_TEMPLATE = f"lavap test health healthAllProviders.yml --node {{}}"

JSINFO_LAVAP_PROVIDER_HEALTH_EXCLUDE_TERMS = ['health_all_providers', 'frozen_provider_alert']
JSINFO_LAVAP_PROVIDER_HEALTH_COMPLETED_STRING = "completed health run" 
JSINFO_LAVAP_PROVIDER_HEALTH_TIMEOUT = 10 * 60

JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL = os.getenv('JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL', "https://public-rpc.lavanet.xyz:443")

JSINFO_LAVAP_LOG_PREFIX = os.getenv('JSINFO_LAVAP_LOG_PREFIX', "")

JSINFO_LAVAP_PROVIDER_HEALTH_INTERVAL = 5 * 60

def logger(message):
    print(f"{datetime.now()} {JSINFO_LAVAP_LOG_PREFIX} LavapHealthRunner - {message}")


def run_command(node_url):
    command = JSINFO_LAVAP_PROVIDER_HEALTH_COMMAND_TEMPLATE.format(node_url)
    logger(f"Running command: {command}")
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, shell=True)

    def monitor():
        if process.poll() is None:
            logger("Command timed out")
            process.terminate()

    timer = threading.Timer(JSINFO_LAVAP_PROVIDER_HEALTH_TIMEOUT, monitor)
    timer.start()

    completed = False
    while True:
        output = process.stdout.readline().decode()
        if output == '' and process.poll() is not None:
            break
        if output:
            if JSINFO_LAVAP_PROVIDER_HEALTH_COMPLETED_STRING in output:
                completed = True
                logger("Command completed successfully")
            if not any(term in output for term in JSINFO_LAVAP_PROVIDER_HEALTH_EXCLUDE_TERMS):
                logger(output.strip())

    timer.cancel()
    return completed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node_url', default=JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL)
    args = parser.parse_args()

    os.chdir(os.path.dirname(os.path.realpath(__file__)))

    while True:
        try:
            completed = run_command(args.node_url)
            if completed:
                logger(f"Waiting for {JSINFO_LAVAP_PROVIDER_HEALTH_INTERVAL/60} minutes before running the command again...")
                time.sleep(JSINFO_LAVAP_PROVIDER_HEALTH_INTERVAL)
        except Exception:
            logger("Exception occurred")


if __name__ == "__main__":
    logger(f"JSINFO_LAVAP_PROVIDER_HEALTH_COMMAND_TEMPLATE: {JSINFO_LAVAP_PROVIDER_HEALTH_COMMAND_TEMPLATE}")
    logger(f"JSINFO_LAVAP_PROVIDER_HEALTH_EXCLUDE_TERMS: {JSINFO_LAVAP_PROVIDER_HEALTH_EXCLUDE_TERMS}")
    logger(f"JSINFO_LAVAP_PROVIDER_HEALTH_COMPLETED_STRING: {JSINFO_LAVAP_PROVIDER_HEALTH_COMPLETED_STRING}")
    logger(f"JSINFO_LAVAP_PROVIDER_HEALTH_TIMEOUT: {JSINFO_LAVAP_PROVIDER_HEALTH_TIMEOUT}")
    logger(f"JSINFO_LAVAP_PROVIDER_HEALTH_INTERVAL: {JSINFO_LAVAP_PROVIDER_HEALTH_INTERVAL}")
    logger(f"JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL: {JSINFO_LAVAP_PROVIDER_HEALTH_DEFAULT_NODE_URL}")
    main()