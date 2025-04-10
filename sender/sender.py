import csv
import json
import time
import requests
from datetime import datetime

CSV_FILE = 'ip_addresses.csv'
SERVER_URL = 'http://backend:5000/api/package'


def send_packages():
    with open(CSV_FILE, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        data = list(reader)

    for i in range(len(data)):
        package = data[i]
        package_data = {
            "ip": package["ip address"],
            "latitude": float(package["Latitude"]),
            "longitude": float(package["Longitude"]),
            "timestamp": int(package["Timestamp"]),
            "suspicious": int(float(package["suspicious"]))
        }

        if i > 0:
            t1 = int(data[i-1]["Timestamp"])
            t2 = int(package["Timestamp"])
            sleep_time = t2 - t1
            print("Sleeping for", sleep_time, "second(s)")
            time.sleep(max(sleep_time, 0))

        try:
            requests.get(SERVER_URL, json=package_data, timeout=1)
            print(f"Sent package: {package_data}")
        except requests.exceptions.RequestException as e:
            print(f"Failed to send: {e}")

if __name__ == "__main__":
    while True:
        send_packages()
        print("[SENDER] All the packages are sent, continuing simulation on the loop")

