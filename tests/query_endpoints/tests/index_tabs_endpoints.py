#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests

# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

any_missing = False

def fetch_json_data(url):
    """Fetch JSON data from a URL."""
    response = requests.get(url)
    return response.json()

def parse_expected_keys(expected_keys):
    """Parse the expected keys into a dictionary with parent and child keys."""
    parsed_keys = {}
    for key in expected_keys:
        if ':' in key:
            parent_key, child_keys_str = key.split(':[')
            child_keys = child_keys_str.rstrip(']').split(',')
            parsed_keys[parent_key] = child_keys
        else:
            parsed_keys[key] = []
    return parsed_keys

def check_current_level_keys(json_data, parent_key, child_keys):
    """Check for missing and unexpected keys at the current JSON level."""
    global any_missing
    if parent_key:
        current_level_data = json_data.get(parent_key, {})
    else:
        current_level_data = json_data

    # Handle case where current_level_data is a list of dictionaries
    for item in current_level_data:
        if isinstance(item, dict):
            actual_keys = set(item.keys())
            expected_keys = set(child_keys if child_keys else item.keys())

            missing_keys = expected_keys - actual_keys
            unexpected_keys = actual_keys - expected_keys

            if missing_keys or unexpected_keys:
                if missing_keys:
                    print(f"Missing keys in one of the items at {parent_key}: {', '.join(missing_keys)}")
                    any_missing = True
                if unexpected_keys:
                    print(f"Unexpected keys in one of the items at {parent_key}: {', '.join(unexpected_keys)}")
                    any_missing = True


def check_keys(url, *expected_keys):
    """Main function to check keys."""
    print(f"Checking keys for {url}...")
    json_data = fetch_json_data(url)
    parsed_keys = parse_expected_keys(expected_keys)

    for parent_key, child_keys in parsed_keys.items():
        check_current_level_keys(json_data, parent_key, child_keys)

check_keys(server_address + "/indexProviders", "data:[provider,moniker,monikerfull,rewardSum,totalServices,totalStake]")

def check_csv_first_line(url, expected_line):
    """Check if the first line of the CSV file matches the expected line."""
    global any_missing
    response = requests.get(url)
    response.raise_for_status()  # Ensure we got a successful response

    # Decode the content and split into lines
    content = response.content.decode('utf-8')
    first_line = content.splitlines()[0]

    if first_line == expected_line:
        print("The first line matches the expected line.")
    else:
        print("The first line does not match the expected line.")
        print(f"Expected: {expected_line}")
        print(f"Found: {first_line}")
        any_missing = True

check_csv_first_line(server_address + "/indexProvidersCsv", '"Moniker","Provider Address","Total Rewards","Total Services","Total Stake"')

if any_missing:
    sys.exit(1)