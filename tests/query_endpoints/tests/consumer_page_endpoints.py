#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import unittest
import random

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping consumer endpoints tests")
    sys.exit(0)

# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestConsumerEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Fetch consumer addresses before running tests."""
        response = requests.get(f"{server_address}/consumers")
        consumers_data = response.json()
        cls.consumers = consumers_data['consumers']
        cls.selected_consumers = random.sample(cls.consumers, 3) if len(cls.consumers) >= 3 else cls.consumers

    def test_consumer_endpoint_structure(self):
        """Test the structure of the response from the consumer endpoint for random consumers."""
        for consumer in self.selected_consumers:
            addr = consumer['address']
            url = f"{server_address}/consumer/{addr}"
            response = requests.get(url)
            self.assertEqual(response.status_code, 200, "Expected status code 200")

            data = response.json()
            # Verify expected keys
            expected_keys = ['addr', 'cuSum', 'relaySum', 'rewardSum', 'conflicts']
            for key in expected_keys:
                self.assertIn(key, data, f"Expected '{key}' key in response")

            # Additional check for the structure of the first conflict if exists
            if data['conflicts']:
                first_conflict = data['conflicts'][0]
                expected_conflict_keys = ['id', 'blockId', 'consumer', 'specId', 'tx', 'voteId', 'requestBlock', 'voteDeadline', 'apiInterface', 'apiURL', 'connectionType', 'requestData']
                for key in expected_conflict_keys:
                    self.assertIn(key, first_conflict, f"Expected '{key}' key in first conflict")

    # def test_consumer_charts_endpoint_structure(self):
    #     """Test the structure of the response from the consumerCharts endpoint for random consumers."""
    #     for consumer in self.selected_consumers:
    #         addr = consumer['address']
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