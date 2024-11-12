#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import unittest
import random

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping provider page endpoints tests")
    sys.exit(0)
    
# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestProviderEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Fetch provider addresses before running tests."""
        response = requests.get(f"{server_address}/providers")
        providers_data = response.json()
        cls.providers = providers_data['providers']
        cls.selected_providers = random.sample(cls.providers, 3) if len(cls.providers) >= 3 else cls.providers
        print("selected_providers: ", cls.selected_providers)

    def test_provider_endpoint_structure(self):
        """Test the structure of the response from the provider endpoint for random providers."""
        addr = "-"
        url = "-"
        response = "-"
        data = "-"

        for provider in self.selected_providers:
            try:
                url = f"{server_address}/provider/{provider}"
                response = requests.get(url)
                self.assertEqual(response.status_code, 200, "Expected status code 200")

                data = response.json()
                # Verify expected keys
                expected_keys = ['height', 'datetime', 'provider', 'moniker', 'monikerfull',]
                for key in expected_keys:
                    self.assertIn(key, data, f"Expected '{key}' key in response")
            except:
                print(f"Failed test_provider_endpoint_structure for provider {addr}, url: {url}")
                print(f"Response: {response}")
                print(f"Data: {data}")
                raise
        
    # def test_provider_cards_endpoint_structure(self):
    #     """Test the structure of the response from the provider endpoint for random providers."""
    #     addr = "-"
    #     url = "-"
    #     response = "-"
    #     data = "-"

    #     for provider in self.selected_providers:
    #         try:
    #             url = f"{server_address}/providerCards/{provider}"
    #             response = requests.get(url)
    #             self.assertEqual(response.status_code, 200, "Expected status code 200")

    #             data = response.json()
    #             # Verify expected keys
    #             expected_keys = ['cuSum', 'relaySum', 'rewardSum', 'stakeSum', 'claimedRewardsAllTime', 'claimedRewards30DaysAgo','claimableRewards']
    #             for key in expected_keys:
    #                 self.assertIn(key, data, f"Expected '{key}' key in response")
    #         except:
    #             print(f"Failed test_provider_cards_endpoint_structure for provider {addr}, url: {url}")
    #             print(f"Response: {response}")
    #             print(f"Data: {data}")
    #             raise
        
    def test_provider_charts_endpoint_structure(self):
        """Test the structure of the response from the providerCharts endpoint for random providers."""
        for provider in self.selected_providers:
            url = f"{server_address}/providerCharts/{provider}"
            response = requests.get(url)
            self.assertEqual(response.status_code, 200, "Expected status code 200")

            data = response.json()
            # Verify the 'data' key exists and has the expected structure
            self.assertIn('data', data, "Expected 'data' key in response")
            self.assertIsInstance(data['data'], list, "'data' should be a list")
            if data['data']:
                first_item = data['data'][0]
                expected_keys = ['date', 'qos', 'qosSyncAvg', 'qosAvailabilityAvg', 'qosLatencyAvg']
                for key in expected_keys:
                    self.assertIn(key, first_item, f"Expected '{key}' key in first item")

if __name__ == '__main__':
    unittest.main()