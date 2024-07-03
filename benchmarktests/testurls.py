#!/usr/bin/env python3

import requests
import time

print("Starting script...")

# Fetch URLs from the endpoint
# print("Fetching URLs from the endpoint...")
# response = requests.get("http://localhost:8081/cacheLinks")
# data = response.json()
# urls = data['urls'] 

print("Using hardcoded URLs...")
urls = [
    # "/providerRewardsCsv/lava@1w2620hs6all32zp2m9m5cx9mtu2apdygplhsac",
    # "/providerReportsCsv/lava@1w2620hs6all32zp2m9m5cx9mtu2apdygplhsac",

    # "/providerDelegatorRewardsCsv/lava@1w2620hs6all32zp2m9m5cx9mtu2apdygplhsac",
    # "/providerBlockReportsCsv/lava@1w2620hs6all32zp2m9m5cx9mtu2apdygplhsac",
    # "/consumer/lava@1dwsy08g5f4nuu55r75xmw2k3w05aadnsa97rts",

    "/spec/AXELART",
]

BASE_URL = "http://localhost:8081"

# Function to make requests and print the required information
def make_requests_and_print_info(url):
    print(f"Making requests for URL: {url}")
    total_time = 0
    success_count = 0

    for _ in range(3):
        print(f"Sending request to {BASE_URL}{url}")
        start_time = time.time()
        response = requests.get(f"{BASE_URL}{url}")
        end_time = time.time()

        request_time = end_time - start_time
        total_time += request_time

        if response.status_code == 200:
            success_count += 1
            print(f"Time: {request_time}s, Status Code: 200")
        else:
            print(f"Time: {request_time}s, Status Code: {response.status_code}")

    avg_time = total_time / 3
    print(f"Average Time for {url}: {avg_time}s, Success Rate: {success_count}/3\n")

# Iterate over each URL and perform the operations
for url in urls:
    make_requests_and_print_info(url)

print("Script completed.")