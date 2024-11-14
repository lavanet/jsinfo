#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import random

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping provider csv endpoint tests")
    sys.exit(0)
    
# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

response = requests.get(f"{server_address}/providers")
providers_data = response.json()
providers = providers_data['providers']
selected_providers = random.sample(providers, 3) if len(providers) >= 3 else providers

# Define the curl commands and the expected outputs
commands_and_expected_outputs = []

for provider in selected_providers:
    addr = provider
    commands_and_expected_outputs += [
        (f"{server_address}/providerHealthCsv/{addr}", "time,chain,interface,status,region,message"),
        (f"{server_address}/providerErrorsCsv/{addr}", "date,chain,error"),
        (f"{server_address}/providerStakesCsv/{addr}", "\"Spec\",\"Status\",\"Geolocation\",\"Addons\",\"Extensions\",\"Self Stake\",\"Total Stake\",\"Delegate Limit\",\"Delegate Total\",\"Delegate Commission\""),
        (f"{server_address}/providerEventsCsv/{addr}", "\"Event Type\",\"Block Height\",\"Time\",\"Text1\",\"Text2\",\"Text3\",\"BigInt1\",\"BigInt2\",\"BigInt2\",\"Int1\",\"Int2\",\"Int3\""),
        (f"{server_address}/providerRewardsCsv/{addr}", "\"Spec\",\"Block\",\"Time\",\"Consumer\",\"Relays\",\"CU\",\"QoS\",\"Excellence\""),
        (f"{server_address}/providerReportsCsv/{addr}", "\"Block\",\"Time\",\"CU\",\"Disconnections\",\"Errors\",\"Project\",\"Chain ID\""),
        (f"{server_address}/providerDelegatorRewardsCsv/{addr}", "time,chain,amount"),
        (f"{server_address}/providerBlockReportsCsv/{addr}", "time,blockId,tx,chainId,chainBlockHeight"),
    ]

def compare_output(url, expected_output):
    response = requests.get(url)
    if response.status_code == 200:
        first_line = response.text.split('\n', 1)[0].strip()
        if first_line == expected_output:
            print(f"Match found for: {url}")
        elif first_line == "Data is unavailable now":
            print(f"Data is unavailable now for: {url}")
        else:
            print(f"Mismatch found for {url}:\nExpected: {expected_output}\nActual: {first_line}\n")
            sys.exit(1)
    else:
        print(f"Error fetching data from {url}, status code: {response.status_code}")

# Execute and compare
for command, expected_output in commands_and_expected_outputs:
    compare_output(command, expected_output)