#!/usr/bin/env python3 -u

import subprocess
import time
import os
import signal
import sys

def monitor_command(cmd, timeout):
    # Start the command
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    last_output_time = time.time()

    while True:
        # Wait for output or a timeout
        try:
            output = process.stdout.readline().decode().strip()
            if output:
                print(output)
                last_output_time = time.time()
            elif time.time() - last_output_time > timeout:
                print('No output for', timeout, 'seconds. Killing command.')
                os.kill(process.pid, signal.SIGKILL)
                return
        except Exception as e:
            print('Error while monitoring command:', e)
            return

        # Check if the process has finished
        if process.poll() is not None:
            return

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: ./monitor_command.py <timeout_in_seconds> "<command>"')
        sys.exit(1)

    timeout = int(sys.argv[1])
    cmd = sys.argv[2]
    monitor_command(cmd, timeout)