#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest
import requests
import os
import sys

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping spec endpoint tests")
    sys.exit(0)
    
# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestAPIDataContent(unittest.TestCase):
    def test_spec_endpoint_content(self):
        response = requests.get(f"{server_address}/spec/APT1")
        if response.status_code != 200:
            response = requests.get(f"{server_address}/spec/LAVA")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('height', data)
        self.assertIn('datetime', data)
        self.assertIn('specId', data)
        self.assertIn('cuSum', data)
        self.assertIn('relaySum', data)
        self.assertIn('rewardSum', data)
        self.assertIn('providerCount', data)
        self.assertIn('endpointHealth', data)
        self.assertIn('healthy', data['endpointHealth'])
        self.assertIn('unhealthy', data['endpointHealth'])
        self.assertIsInstance(data['height'], int)
        self.assertIsInstance(data['datetime'], int)

    def test_specStakes_endpoint_content(self):
        response = requests.get(f"{server_address}/specStakes/APT1")
        if response.status_code != 200:
            response = requests.get(f"{server_address}/specStakes/LAVA")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('data', data)
        self.assertIsInstance(data['data'], list)
        for item in data['data']:
            self.assertIn('stake', item)
            self.assertIn('delegateLimit', item)
            self.assertIn('delegateTotal', item)
            self.assertIn('delegateCommission', item)
            self.assertIn('totalStake', item)
            self.assertIn('appliedHeight', item)
            self.assertIn('geolocation', item)
            self.assertIn('addons', item)
            self.assertIn('extensions', item)
            self.assertIn('status', item)
            self.assertIn('provider', item)
            self.assertIn('moniker', item)
            self.assertIn('monikerfull', item)
            self.assertIn('blockId', item)
            self.assertIn('cuSum30Days', item)
            self.assertIn('relaySum30Days', item)
            self.assertIn('cuSum90Days', item)
            self.assertIn('relaySum90Days', item)
            self.assertIsInstance(item['status'], int)

    def test_specCharts_endpoint_content(self):
        response = requests.get(f"{server_address}/specCharts/APT1")
        if response.status_code != 200:
            response = requests.get(f"{server_address}/specCharts/LAVA")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('data', data)
        self.assertIsInstance(data['data'], list)
        for item in data['data']:
            self.assertIn('date', item)
            self.assertIn('qos', item)
            self.assertIn('qosSyncAvg', item)
            self.assertIn('qosAvailabilityAvg', item)
            self.assertIn('qosLatencyAvg', item)
            self.assertIn('data', item)
            for sub_item in item['data']:
                self.assertIn('provider', sub_item)
                self.assertIn('cus', sub_item)
                self.assertIn('relays', sub_item)

if __name__ == '__main__':
    unittest.main()