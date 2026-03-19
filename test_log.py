import os
import json
import csv
from datetime import datetime

CSV_FILE = "attendance.csv"
JSON_FILE = "attendance.json"
marked_today = set()

def load_json():
    if not os.path.exists(JSON_FILE): return []
    try:
        with open(JSON_FILE, "r") as f:
            content = f.read().strip()
            return json.loads(content) if content else []
    except Exception as e:
        print(f"Load error: {e}")
        return []

def save_json(data):
    try:
        with open(JSON_FILE, "w") as f: 
            json.dump(data, f, indent=4)
        print("Saved JSON")
    except Exception as e:
        print(f"Error saving JSON: {e}")

def log_known(name, confidence, session="Morning"):
    today = datetime.now().strftime("%Y-%m-%d")
    time_str = datetime.now().strftime("%H:%M:%S")
    key = f"{name}_{today}_{session}"
    
    if key in marked_today: 
        print("Duplicate")
        return

    try:
        file_exists = os.path.exists(CSV_FILE)
        with open(CSV_FILE, "a", newline="") as f:
            writer = csv.writer(f)
            if not file_exists: 
                writer.writerow(["Name", "Date", "Time", "Session", "Status", "Confidence"])
            writer.writerow([name, today, time_str, session, "Present", f"{confidence:.2f}"])
        print("Logged to CSV")
    except Exception as e:
        print(f"Error logging to CSV: {e}")

    try:
        data = load_json()
        data.append({
            "type": "known", 
            "name": name, 
            "date": today, 
            "time": time_str, 
            "session": session, 
            "status": "Present",
            "confidence": round(confidence, 2)
        })
        save_json(data)
    except Exception as e:
        print(f"Error logging to JSON: {e}")

if __name__ == "__main__":
    log_known("TestUser", 99.9, "Night")
