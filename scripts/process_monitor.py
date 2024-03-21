#!/usr/bin/env python3 -u

import subprocess
import time
import os
import signal
import sys
import threading

def monitor_command(cmd, timeout):
    # Start the command
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=1, universal_newlines=True)

    last_output_time = time.time()

    def check_output():
        nonlocal last_output_time
        while True:
            if process.poll() is not None:
                os.kill(os.getpid(), signal.SIGTERM)
            output = process.stdout.readline().strip()
            if output:
                print(output)
                last_output_time = time.time()

    def check_timeout():
        nonlocal last_output_time
        while True:
            if time.time() - last_output_time > timeout:
                print('No output for', timeout, 'seconds. Killing command.')
                os.kill(process.pid, signal.SIGKILL)
                os.kill(os.getpid(), signal.SIGTERM)
            time.sleep(1)

    # Start the threads
    thread_output = threading.Thread(target=check_output)
    thread_output.start()
    thread_timeout = threading.Thread(target=check_timeout)
    thread_timeout.start()

    # Wait for the threads to finish
    thread_output.join()
    thread_timeout.join()

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: ./monitor_command.py <timeout_in_seconds> "<command>"')
        sys.exit(1)

    timeout = int(sys.argv[1])
    cmd = sys.argv[2]
    monitor_command(cmd, timeout)