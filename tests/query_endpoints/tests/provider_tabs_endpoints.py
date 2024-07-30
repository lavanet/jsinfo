#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import unittest
import random

# TESTS_FULL=True; 
if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping provider tabs endpoints tests")
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

    def test_provider_health(self):
        for provider in self.selected_providers:
            url = f"{server_address}/providerHealth/{provider['address']}"
            response = requests.get(url)
            try:
                assert response.status_code == 200
                if len(response.json()['data']) == 0:
                    continue
                data = response.json()['data'][0]
                assert 'id' in data
                assert 'provider' in data
                assert 'timestamp' in data
                assert 'spec' in data
                assert 'interface' in data
                assert 'status' in data
                assert 'message' in data
            except AssertionError:
                print(f"Failed test_provider_health for url: {url}")
                print(f"Response status code: {response.status_code}")
                print(f"Response text: {response.text}")
                raise

    def test_provider_errors(self):
        for provider in self.selected_providers:
            url = f"{server_address}/providerErrors/{provider['address']}"
            response = None
            try:
                response = requests.get(url)
                assert response.status_code == 200
                data = response.json()['data']
                assert isinstance(data, list)
            except AssertionError:
                print(f"Failed test_provider_health for provider url: {url}")
                print(f"Response status code: {response.status_code}")
                print(f"Response text: {response.text}")
                raise

    def test_provider_stakes(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerStakes/{provider['address']}")
            assert response.status_code == 200
            if len(response.json()['data']) == 0:
                continue
            data = response.json()['data'][0]
            assert 'stake' in data
            assert 'delegateLimit' in data
            assert 'delegateTotal' in data
            assert 'delegateCommission' in data
            assert 'totalStake' in data
            assert 'appliedHeight' in data
            assert 'geolocation' in data

    def test_provider_events(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerEvents/{provider['address']}")
            assert response.status_code == 200
            if len(response.json()['data']) == 0:
                continue
            data = response.json()['data'][0]
            events = data['events']
            assert 'id' in events
            assert 'eventType' in events
            assert 't1' in events

    def test_provider_rewards(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerRewards/{provider['address']}")
            assert response.status_code == 200
            if len(response.json()['data']) == 0:
                continue
            data = response.json()['data'][0]
            relay_payments = data['relay_payments']
            assert 'id' in relay_payments
            assert 'relays' in relay_payments
            assert 'cu' in relay_payments
            assert 'datetime' in relay_payments
            assert 'qosSync' in relay_payments

    def test_provider_reports(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerReports/{provider['address']}")
            assert response.status_code == 200
            data = response.json()['data']
            assert isinstance(data, list)  # Expecting data to be a list

    def test_provider_delegator_rewards(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerDelegatorRewards/{provider['address']}")
            assert response.status_code == 200
            data = response.json()['data']
            assert isinstance(data, list)  # Expecting data to be a list

    def test_provider_block_reports(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerBlockReports/{provider['address']}")
            assert response.status_code == 200
            try:
                if len(response.json()['data']) == 0:
                    continue
                data = response.json()['data'][0]
                assert 'id' in data
                assert 'blockId' in data
                assert 'tx' in data
                assert 'timestamp' in data
                assert 'chainId' in data
                assert 'chainBlockHeight' in data
            except:
                print(f"Failed test_provider_health for provider {provider['address']}")
                print(f"Response: {response.json()}")
                raise

    def test_provider_latest_health(self):
        for provider in self.selected_providers:
            url = f"{server_address}/providerLatestHealth/{provider['address']}"
            response = requests.get(url)
            response_json = None
            try:
                response_json = response.json()
            except:
                pass
            if response_json:
                if 'error' in response_json:
                    assert response_json['error'] == "No recent health records for provider"
                    continue
            try:
                assert response.status_code == 200, f"Expected status code 200, got {response.status_code} for URL: {url}. Response: {response_json}"
            except AssertionError as e:
                print(f"Assertion Error: {e}")
                raise
            try:
                assert 'data' in response_json
                data = response_json['data']
                assert 'provider' in data
                assert 'specs' in data
                for spec in data['specs']:
                    assert 'spec' in spec
                    assert 'specData' in spec
                    specData = spec['specData']
                    assert 'overallStatus' in specData
                    assert 'interfaces' in specData
                    for interface_name, regions in specData['interfaces'].items():
                        for region, details in regions.items():
                            assert 'status' in details
                            assert 'data' in details
                            assert 'timestamp' in details
            except:
                print(f"Failed test_provider_health for provider {provider['address']}")
                print(f"Response: {response_json}")
                raise

if __name__ == '__main__':
    unittest.main()