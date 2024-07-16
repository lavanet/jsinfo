from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import signal
import subprocess
import threading
import time
from typing import Dict, List, Optional, Any
from utils import log, error, exit_script, log, safe_json_dump, safe_json_load
from env import HTTP_SERVER_ADDRESS
from dbworker import db_add_provider_health_data

def fmt_unhealthy_error(msg):
    if msg.strip().lower() == "context deadline exceeded":
        return "provider query timed out"
    return msg

def parse_and_save_provider_health_status_from_request(data: Dict[str, Any], guid: str) -> List[Dict[str, Any]]:
    parsed_data: List[Dict[str, Any]] = []

    if data is None:
        log("parse_and_save_provider_health_status_from_request", "error - data is None")
        return []
    
    if 'providerData' not in data and 'unhealthyProviders' not in data and not 'latestBlocks' in data:
        log("parse_and_save_provider_health_status_from_request", "bad data:: Keys 'providerData' or 'unhealthyProviders' not found in data: " + safe_json_dump(data))
        return None
    
    processed_ids = set()

    for key, value in data.get('providerData', {}).items():
        if key in processed_ids:
            continue
        processed_ids.add(key)

        provider_id, spec, apiinterface = key.strip('"').split(' | ')

        if data['latestBlocks'][spec] == 0:
            msg = data.get('unhealthyProviders', {}).get(key, "lateset block request failed for spec")
            msg = fmt_unhealthy_error(msg)
            db_add_provider_health_data(guid, provider_id, spec, apiinterface, "unhealthy", {"message": msg})
        if value['block'] == 0:
            msg = data.get('unhealthyProviders', {}).get(key, "lateset block request failed on provider side")
            msg = fmt_unhealthy_error(msg)
            db_add_provider_health_data(guid, provider_id, spec, apiinterface, "unhealthy", {"message": msg})
        else:
            health_data = {
                'block': value['block'],
                'others': data['latestBlocks'][spec],
                'latency': value['latency'],
            }

            db_add_provider_health_data(guid, provider_id, spec, apiinterface, "healthy", health_data)

    for key, value in data.get('unhealthyProviders', {}).items():
        if key in processed_ids:
            continue
        processed_ids.add(key)
                
        provider_id, spec, apiinterface = key.strip('"').split(' | ')

        if value.strip() != "":
            value = {"message": fmt_unhealthy_error(value)}
        else:
            value = ""
        db_add_provider_health_data(guid, provider_id, spec, apiinterface, "unhealthy", value)

    for key, value in data.get('frozenProviders', {}).items():
        if key in processed_ids:
            continue
        processed_ids.add(key)
            
        provider_id, spec, apiinterface = key.strip('"').split(' | ')

        db_add_provider_health_data(guid, provider_id, spec, apiinterface, "frozen", "")

    return parsed_data
    
class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        content_length: int = int(self.headers['Content-Length'])
        post_data: bytes = self.rfile.read(content_length)
        data: Optional[Dict[str, Any]] = safe_json_load(post_data.decode('utf-8'))

        if data != None:
            guid: Optional[str] = data.get('resultsGUID',"")
            if guid.strip() == "":
                log("http_server_post", "Missing 'resultsGUID' in the received data")
            else:
                parse_and_save_provider_health_status_from_request(data, guid)

        # Send a 200 OK response
        self.send_response(200)
        self.end_headers()

def find_pid_by_port(port):
    """Find the PID of the process listening on the given port. Return None if multiple PIDs are found."""
    command = f"lsof -ti:{port}"
    try:
        output = subprocess.check_output(command, shell=True).decode('utf-8').strip()
        pids = output.split('\n')
        if len(pids) > 1:
            return None
        return pids[0]
    except subprocess.CalledProcessError:
        return None
    
def kill_process_by_pid(pid):
    """Kill the process by PID."""
    try:
        os.kill(int(pid), signal.SIGKILL)
        print(f"Process {pid} has been killed for listening on the webserver port")
    except Exception as e:
        pass

def run_server_thread() -> None:
    try:
        # Attempt to find and kill any existing process on the port
        pid = find_pid_by_port(HTTP_SERVER_ADDRESS[1])
        if pid:
            log("run_server", f"{pid} on port {HTTP_SERVER_ADDRESS[1]}, killing it.")
            kill_process_by_pid(pid)
            time.sleep(1)
        
        httpd = HTTPServer(HTTP_SERVER_ADDRESS, RequestHandler)
        log("run_server", 'Server running on ' + HTTP_SERVER_ADDRESS[0] + ':' + str(HTTP_SERVER_ADDRESS[1]))
        httpd.serve_forever()
    except Exception as e:
        error("run_server", f"Server failed with error: {e}")
        exit_script()

def start_http_server():
    server_thread = threading.Thread(target=run_server_thread, name="http_server")
    server_thread.start()