#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import unittest

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping events page endpoints tests")
    sys.exit(0)

# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestEndpoints(unittest.TestCase):
    def test_events_endpoint(self):
        url = f"{server_address}/events"
        response = requests.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(isinstance(data, dict))
        self.assertIn('height', data)
        self.assertTrue(isinstance(data['height'], int))
        self.assertIn('datetime', data)
        self.assertTrue(isinstance(data['datetime'], int))

    def test_eventsEvents_endpoint(self):
        url = f"{server_address}/eventsEvents"
        response = requests.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(isinstance(data, dict))
        self.assertIn('data', data)
        self.assertTrue(isinstance(data['data'], list))
        if data['data']: 
            item = data['data'][0]
            self.assertIn('id', item)
            self.assertIn('eventType', item)
            self.assertIn('provider', item)

    def test_eventsRewards_endpoint(self):
        url = f"{server_address}/eventsRewards"
        response = requests.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(isinstance(data, dict))
        self.assertIn('data', data)
        self.assertTrue(isinstance(data['data'], list))
        if data['data']:
            item = data['data'][0]
            self.assertIn('id', item)
            self.assertTrue(isinstance(item['id'], int))
            self.assertIn('relays', item)
            self.assertTrue(isinstance(item['relays'], int))
            self.assertIn('cu', item)
            self.assertTrue(isinstance(item['cu'], int))
            self.assertIn('datetime', item)
            self.assertTrue(isinstance(item['datetime'], str)) 

    def test_eventsReports_endpoint(self):
        url = f"{server_address}/eventsReports"
        response = requests.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(isinstance(data, dict))
        self.assertIn('data', data)
        self.assertTrue(isinstance(data['data'], list))
        if data['data']:
            item = data['data'][0]
            self.assertIn('provider', item)
            self.assertTrue(isinstance(item['provider'], str))
            self.assertIn('moniker', item)
            self.assertTrue(isinstance(item['moniker'], str))
            self.assertIn('blockId', item)
            self.assertTrue(isinstance(item['blockId'], int))
            self.assertIn('cu', item)
            self.assertTrue(isinstance(item['cu'], int))
    
if __name__ == '__main__':
    unittest.main()