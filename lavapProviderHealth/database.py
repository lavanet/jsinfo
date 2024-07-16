import time, psycopg2
import traceback
from env import POSTGRES_URL
from utils import log, error

db_conn = psycopg2.connect(POSTGRES_URL)
db_cur = db_conn.cursor()

def db_reconnect():
    global db_conn, db_cur
    db_conn = psycopg2.connect(POSTGRES_URL)
    db_cur = db_conn.cursor()

def db_execute_operation(query, params, retries=3):
    global db_conn, db_cur
    for i in range(retries):
        try:
            log("db_execute_operation", f"Executing query: {query} with params: {params}")
            db_cur.execute(query, params)
            db_conn.commit()
            # log("db_execute_operation", "Query executed successfully")
            return True
        except Exception as e:
            error("db_execute_operation", f"Query: {query}, Type: {type(query)}")
            error("db_execute_operation", f"Params: {params}, Type: {type(params)}")
            error("db_execute_operation", f"Error executing DB operation: {e}")
            traceback.print_exc()
            time.sleep(1)
            db_reconnect()
    return False

def db_execute_operation_nolog(query, params, retries=3):
    global db_conn, db_cur
    for i in range(retries):
        try:
            # log("db_execute_operation", f"Executing query: {query} with params: {params}")
            db_cur.execute(query, params)
            db_conn.commit()
            # log("db_execute_operation", "Query executed successfully")
            return True
        except Exception as e:
            error("db_execute_operation", f"Query: {query}, Type: {type(query)}")
            error("db_execute_operation", f"Params: {params}, Type: {type(params)}")
            error("db_execute_operation", f"Error executing DB operation: {e}")
            traceback.print_exc()
            time.sleep(1)
            db_reconnect()
    return False

def db_cur_fetchone():
    try:
        return db_cur.fetchone()
    except:
        return None
