#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import requests
import unittest

# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'localhost:8081')

class TestIndexChartsEndpoint(unittest.TestCase):
    def test_index_charts_structure(self):
        """Test the structure of the response from the indexCharts endpoint."""
        url = server_address + "/indexCharts"
        response = requests.get(url)
        self.assertEqual(response.status_code, 200, "Expected status code 200")

        # Parse JSON response
        data = response.json()
        self.assertIn('data', data, "Expected 'data' key in response")
        self.assertIsInstance(data['data'], list, "'data' should be a list")

        # Check the structure of the first item in the list, if present
        if data['data']:
            first_item = data['data'][0]
            self.assertIn('date', first_item, "Expected 'date' key in first item")
            self.assertIn('qos', first_item, "Expected 'qos' key in first item")
            self.assertIn('data', first_item, "Expected 'data' key in first item")
            self.assertIsInstance(first_item['data'], list, "'data' in first item should be a list")

            # Optionally, check the structure of the nested items
            if first_item['data']:
                nested_item = first_item['data'][0]
                self.assertIn('chainId', nested_item, "Expected 'chainId' key in nested item")
                self.assertIn('cuSum', nested_item, "Expected 'cuSum' key in nested item")
                self.assertIn('relaySum', nested_item, "Expected 'relaySum' key in nested item")

    def test_index_structure(self):
        """Test the structure of the response from the index endpoint."""
        url = server_address + "/index"
        response = requests.get(url)
        self.assertEqual(response.status_code, 200, "Expected status code 200")

        # Parse JSON response
        data = response.json()
        self.assertIn('height', data, "Expected 'height' key in response")
        self.assertIn('datetime', data, "Expected 'datetime' key in response")
        self.assertIn('cuSum', data, "Expected 'cuSum' key in response")
        self.assertIn('relaySum', data, "Expected 'relaySum' key in response")
        self.assertIn('stakeSum', data, "Expected 'stakeSum' key in response")
        self.assertIn('allSpecs', data, "Expected 'allSpecs' key in response")
        self.assertIsInstance(data['allSpecs'], list, "'allSpecs' should be a list")

        # Check the structure of the first item in the 'allSpecs' list, if present
        if data['allSpecs']:
            first_spec = data['allSpecs'][0]
            self.assertIn('chainId', first_spec, "Expected 'chainId' key in first spec")
            self.assertIn('relaySum', first_spec, "Expected 'relaySum' key in first spec")
            
if __name__ == '__main__':
    unittest.main()

