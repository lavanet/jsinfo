#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import requests
import unittest

if os.getenv('TESTS_FULL', 'false').lower() != 'true':
    print("Skipping provider csv tests")
    sys.exit(0)
    
# Get TESTS_SERVER_ADDRESS from environment variable, default to localhost:8081 if not set
server_address = os.getenv('TESTS_SERVER_ADDRESS', 'http://localhost:8081')

class TestCsvEndpoints(unittest.TestCase):
    def fetch_endpoint_data(self, endpoint):
        url = f"{server_address}{endpoint}"
        response = requests.get(url)
        if "Data is unavailable now" in response.text:
            return '', '', 0
        if response.status_code == 200:
            # Split response text into lines and return the first 4 lines joined as a single string
            return '\n'.join(response.text.split('\n')[:4]), '', 0
        else:
            return '', response.text, response.status_code
    
    def test_eventsEventsCsv(self):
        stdout, stderr, returncode = self.fetch_endpoint_data("/eventsEventsCsv")
        if returncode == 0:
            return
        self.assertEqual(returncode, 0, f"Command failed with error: {stderr}")
        self.assertIn('"Provider","Moniker","Consumer"', stdout, "CSV header for eventsEventsCsv not found")

    def test_eventsRewardsCsv(self):
        stdout, stderr, returncode = self.fetch_endpoint_data("/eventsRewardsCsv")
        if returncode == 0:
            return
        self.assertEqual(returncode, 0, f"Command failed with error: {stderr}")
        self.assertIn('"Relays","CU","Pay"', stdout, "CSV header for eventsRewardsCsv not found")

    def test_eventsReportsCsv(self):
        stdout, stderr, returncode = self.fetch_endpoint_data("/eventsReportsCsv")
        if returncode == 0:
            return
        self.assertEqual(returncode, 0, f"Command failed with error: {stderr}")
        self.assertIn('"Provider","Moniker","BlockId"', stdout, "CSV header for eventsReportsCsv not found")

if __name__ == '__main__':
    unittest.main()