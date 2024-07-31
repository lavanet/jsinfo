import subprocess, threading, time, random, shlex, json
from typing import Dict, List, Optional, Any
from utils import log, json_load_or_none, exit_script, replace_archive
from env import HEALTH_RESULTS_GUID, NODE_URL, DEBUG_PRINT_ACCOUNT_INFO_STDOUT

def run_command(command: str, print_stdout: bool = True, timeout: int = 120) -> str:
    for attempt in range(10):
        log('run_command', f"Running command . attempt {attempt}. command:\n{command}")
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, text=True)

        def monitor() -> None:
            if process.poll() is None:
                log('run_command', "Command timed out")
                process.terminate()

        timer = threading.Timer(timeout, monitor)
        timer.start()

        stdout_lines: List[str] = []

        while True:
            stdout_line: str = process.stdout.readline()
            if stdout_line == '' and process.poll() is not None:
                break
            stdout_lines.append(stdout_line)
            if stdout_line and print_stdout:
                log('run_command stdout', stdout_line.strip())

        timer.cancel()

        stderr: str = process.stderr.read()
        if stderr:
            log('run_command stderr', str(stderr).strip())
            if any(error in stderr for error in ["character 'e' looking for beginning of value", "Many Requests", "--from string        Name or address of private key with which to sign"]):
                log('run_command', f"Encountered error in attempt {attempt + 1}, retrying after delay...")
                time.sleep(random.randint(30, 60))  # sleep for random time between 30s to 1 minute
                continue  # retry the command

        stdout_line = process.stdout.read()
        if stdout_line:
            stdout_lines.append(stdout_line)
            if print_stdout:
                log('run_command stdout', stdout_line.strip())

        return ''.join(stdout_lines)

    log('run_command', "All attempts failed, exiting...")
    exit_script()

def run_health_command(address: str, single_provider_specs_interfaces_data: Optional[Dict[str, List[str]]] = None) -> None:
    log('run_health_command', f'Starting health command for address: {address}')
    command = f"lavap test health health_all_providers.yml --node {NODE_URL} --single-provider-address {address} --post-results-guid {HEALTH_RESULTS_GUID} --run-once-and-exit --post-results-skip-spec"
    if single_provider_specs_interfaces_data is not None:
        transformed_data = {provider: [interface[0] for interface in interfaces] 
                    for provider, interfaces in single_provider_specs_interfaces_data.items()}
        command += " --single-provider-specs-interfaces-data " + shlex.quote(json.dumps(transformed_data))
    run_command(command)
    log('run_health_command', 'Health command completed.')

def run_accountinfo_command(address: str) -> Optional[Dict[str, Any]]:
    command = f"lavad q pairing account-info {address} --output json --node {NODE_URL}"
    output = run_command(command, print_stdout=DEBUG_PRINT_ACCOUNT_INFO_STDOUT)
    log('run_accountinfo_command', 'Pairing command completed.')
    return json_load_or_none(replace_archive(output))

def run_subscription_list_command() -> Optional[Dict[str, Any]]:
    command = f"lavad q subscription list --output json --node {NODE_URL}"
    output = run_command(command, print_stdout=DEBUG_PRINT_ACCOUNT_INFO_STDOUT)
    log('run_subscription_list_command', 'Subscription list command completed.')
    return json_load_or_none(output)