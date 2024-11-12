#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import unittest
import random
import json

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping consumer endpoints tests")
    sys.exit(0)

# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestConsumerEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\nFetching consumers list:")
        print("=" * 50)
        
        consumers_url = f"{server_address}/consumers"
        print(f"\n🌐 All Consumers URL: {consumers_url}")
        
        response = requests.get(consumers_url)
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Error fetching consumers: {response.text}")
            return
            
        consumers_data = response.json()
        cls.consumers = consumers_data['consumers']
        print(f"\nTotal consumers found: {len(cls.consumers)}")
        
        # Take just one random consumer
        cls.selected_consumer = random.choice(cls.consumers)
        print(f"\nSelected consumer for testing: {cls.selected_consumer}")
        print("\n" + "=" * 50)

    def test_consumer_endpoint_structure(self):
        """Test the structure of the response from the consumer endpoint."""
        url = f"{server_address}/consumerV2/{self.selected_consumer}"
        
        print("\nTesting consumer endpoint:")
        print("=" * 50)
        print(f"\n🌐 Browser URL: {url}")
        
        response = requests.get(url)
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Error response: {response.text}")
        else:
            print("✅ Response OK")
            data = response.json()
            print(f"Response data: {json.dumps(data, indent=2)}")
        
        self.assertEqual(response.status_code, 200, "Expected status code 200")
        
        data = response.json()
        expected_structure = {
            'addr': str,
            'cuSum': int,
            'relaySum': int,
            'rewardSum': int
        }
        
        for key, expected_type in expected_structure.items():
            self.assertIn(key, data, f"Expected '{key}' in response")
            self.assertIsInstance(data[key], expected_type, 
                f"Expected {key} to be {expected_type.__name__}, got {type(data[key]).__name__}")

    # def test_consumer_charts_endpoint_structure(self):
    #     """Test the structure of the response from the consumerCharts endpoint for random consumers."""
    #     for consumer in self.selected_consumers:
    #         addr = consumer
    #         url = f"{server_address}/consumerCharts/{addr}"
    #         response = requests.get(url)
    #         self.assertEqual(response.status_code, 200, "Expected status code 200")

    #         data = response.json()
    #         # Verify the 'data' key exists and has the expected structure
    #         self.assertIn('data', data, "Expected 'data' key in response")
    #         self.assertIsInstance(data['data'], list, "'data' should be a list")
    #         if data['data']:
    #             first_item = data['data'][0]
    #             expected_keys = ['date', 'qos', 'qosSyncAvg', 'qosAvailabilityAvg', 'qosLatencyAvg']
    #             for key in expected_keys:
    #                 self.assertIn(key, first_item, f"Expected '{key}' key in first item")

if __name__ == '__main__':
    unittest.main()