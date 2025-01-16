#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# TESTS_SERVER_ADDRESS=https://jsinfo.lavanet.xyz/ python3 ./lava_iprpc_endpoint.py 

import os
import unittest
import requests
import logging
from typing import List, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestLavaIpRpcEndpoints(unittest.TestCase):
    def setUp(self):
        self.endpoint = "/lava_iprpc_endpoints"
        self.url = f"{server_address}{self.endpoint}"
        logger.info(f"Testing endpoint: {self.url}")

    def test_endpoint_response(self):
        logger.info("Making request to endpoint...")
        response = requests.get(self.url)
        
        logger.info(f"Response status code: {response.status_code}")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        logger.info(f"Received {len(data)} chain entries")
        
        # Test first chain entry structure
        self.assertGreater(len(data), 0, "Response should contain chain entries")
        
        # Verify required fields in each chain entry
        required_fields = {
            'chainId': str,
            'alias': str,
            'ChainDisplayName': str,
            'DisplayName': str,
            'geolocations': list,
            'features': list,
            'apiEndpoints': dict,
            'logoURL': str,
            'requests': dict
        }

        request_fields = {'24h': int, '7d': int, '30d': int}

        for chain in data:
            chain_id = chain.get('chainId', 'unknown')
            logger.info(f"\nValidating chain: {chain_id}")
            
            # Check all required fields exist with correct types
            for field, field_type in required_fields.items():
                self.assertIn(field, chain, f"Missing {field} in {chain_id}")
                self.assertIsInstance(chain[field], field_type, 
                    f"Invalid type for {field} in {chain_id}")

            # Validate requests structure
            for period, period_type in request_fields.items():
                self.assertIn(period, chain['requests'], 
                    f"Missing {period} in requests for {chain_id}")
                self.assertIsInstance(chain['requests'][period], period_type,
                    f"Invalid type for requests.{period} in {chain_id}")

            # Validate geolocations
            self.assertTrue(all(loc in ["US", "EU", "ASIA"] for loc in chain['geolocations']),
                f"Invalid geolocation in {chain_id}")

            # Validate API endpoints
            self.assertIsInstance(chain['apiEndpoints'], dict,
                f"apiEndpoints should be a dict in {chain_id}")
            for endpoint_type, urls in chain['apiEndpoints'].items():
                self.assertIsInstance(urls, list,
                    f"Invalid endpoint URLs format for {endpoint_type} in {chain_id}")
                for url in urls:
                    self.assertIsInstance(url, str,
                        f"Invalid URL format in {endpoint_type} for {chain_id}")

            logger.info(f"Chain {chain_id} validation passed")

if __name__ == '__main__':
    unittest.main(verbosity=2)