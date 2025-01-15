#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import unittest
import random
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
        logger.info("Fetching provider addresses...")
        response = requests.get(f"{server_address}/providers")
        providers_data = response.json()
        cls.providers = providers_data['providers']
        cls.selected_providers = random.sample(cls.providers, 3) if len(cls.providers) >= 3 else cls.providers
        logger.info(f"Selected providers for testing: {cls.selected_providers}")

    def make_request(self, url: str) -> requests.Response:
        logger.info(f"Making request to: {url}")
        start_time = time.time()
        response = requests.get(url)
        duration = time.time() - start_time
        logger.info(f"Response received in {duration:.2f}s - Status: {response.status_code}")
        if response.status_code != 200:
            logger.error(f"Error response: {response.text[:200]}")
        return response

    def test_provider_health(self):
        logger.info("\n=== Testing Provider Health ===")
        for provider in self.selected_providers:
            url = f"{server_address}/providerHealth/{provider}"
            logger.info(f"\nTesting health for provider: {provider}")
            response = self.make_request(url)
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

    # not testing this for now - it a diffrent db
    # def test_provider_errors(self):
    #     for provider in self.selected_providers:
    #         url = f"{server_address}/providerErrors/{provider}"
    #         response = None
    #         try:
    #             response = requests.get(url)
    #             assert response.status_code == 200
    #             data = response.json()['data']
    #             assert isinstance(data, list)
    #         except AssertionError:
    #             print(f"Failed test_provider_health for provider url: {url}")
    #             print(f"Response status code: {response.status_code}")
    #             print(f"Response text: {response.text}")
    #             raise

    def test_provider_stakes(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerStakes/{provider}")
            assert response.status_code == 200
            if len(response.json()['data']) == 0:
                continue
            data = response.json()['data'][0]
            assert 'stake' in data
            # assert 'delegateLimit' in data
            assert 'delegateTotal' in data
            assert 'delegateCommission' in data
            assert 'totalStake' in data
            assert 'appliedHeight' in data
            assert 'geolocation' in data

    def test_provider_events(self):
        for provider in self.selected_providers:
            url = f"{server_address}/providerEvents/{provider}"
            response = requests.get(url)
            assert response.status_code == 200, f"Expected status code 200, got {response.status_code} for provider {provider}, url: {url}"
            if len(response.json()['data']) == 0:
                continue
            data = response.json()['data'][0]
            events = data['events']
            assert 'id' in events, f"'id' not found in events for provider {provider}, url: {url}"
            assert 'eventType' in events, f"'eventType' not found in events for provider {provider}, url: {url}"
            assert 't1' in events, f"'t1' not found in events for provider {provider}, url: {url}"

    def test_provider_rewards(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerRewards/{provider}")
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
            response = requests.get(f"{server_address}/providerReports/{provider}")
            assert response.status_code == 200
            data = response.json()['data']
            assert isinstance(data, list)  # Expecting data to be a list

    # def test_provider_delegator_rewards(self):
    #     for provider in self.selected_providers:
    #         response = requests.get(f"{server_address}/providerDelegatorRewards/{provider}")
    #         assert response.status_code == 200
    #         data = response.json()['data']
    #         assert isinstance(data, list)  # Expecting data to be a list

    def test_provider_block_reports(self):
        for provider in self.selected_providers:
            response = requests.get(f"{server_address}/providerBlockReports/{provider}")
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
                print(f"Failed test_provider_health for provider {provider}")
                print(f"Response: {response.json()}")
                raise

    def test_provider_latest_health(self):
        for provider in self.selected_providers:
            url = f"{server_address}/providerLatestHealth/{provider}"
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
                    for _, regions in specData['interfaces'].items():
                        for _, details in regions.items():
                            assert 'status' in details
                            assert 'data' in details
                            assert 'timestamp' in details
            except:
                print(f"Failed test_provider_health for provider {provider}")
                print(f"Response: {response_json}")
                raise


if __name__ == '__main__':
    unittest.main()