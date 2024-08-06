#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest
import requests
import os
import sys

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping spec provider health tests")
    sys.exit(0)
    
# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestSpecProviderHealthEndpoint(unittest.TestCase):
    def setUp(self):
        self.test_cases = [
            ("mainnet", "LAVA", "lava@16gjdwqfpvk3dyasy83wsr26pk27kjq9wvfz0qy"),
            ("staging", "STRKS", "lava@1ywcy4y8cajjnfdk82g76qzyzhsehemf58dy906"),
            ("testnet", "STRK", "lava@1lwyx7akkma0kyejl2tkltw0uekvppez3pqpvmh"),
        ]

def test_specProviderHealth_endpoints(self):
    if_happened = False
    for env, spec_id, addr in self.test_cases:
        with self.subTest(env=env, spec_id=spec_id, addr=addr):
            url = f"{server_address}/specProviderHealth/{spec_id}/{addr}"
            response = requests.get(url)
            if response.status_code != 200:
                print(f"Skipping test case due to non-200 response: env={env}, spec_id={spec_id}, addr={addr}, status_code={response.status_code}, url={url}")
                continue
            if_happened = True
            data = response.json()
            self.assertIn('data', data, f"Response for env={env}, spec_id={spec_id}, addr={addr} does not contain 'data' key")
            self.assertIn('healthy', data['data'], f"Data for env={env}, spec_id={spec_id}, addr={addr} does not contain 'healthy' key")
            self.assertIn('unhealthy', data['data'], f"Data for env={env}, spec_id={spec_id}, addr={addr} does not contain 'unhealthy' key")
    if not if_happened:
        raise Exception("No valid response from any of the test cases. All test cases resulted in non-200 responses or were skipped.")

if __name__ == '__main__':
    unittest.main()