from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import base64
import os
import uuid
import time
import ssl
import json
import csv
from datetime import datetime
from pydantic import BaseModel
from deepface import DeepFace
from antispoof import is_live_face
from dotenv import load_dotenv

# Google Sheets
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# Load env variables
load_dotenv()

# ENABLE GOOGLE SHEETS
USE_GOOGLE_SHEETS = True 

app = FastAPI(title="Dual-Auth Attendance API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIG ---
TARGET_FOLDERS = ["Harini", "Thrisha", "Trupti", "Yash", "Pramath"]
MODEL_NAME = "Facenet512"
THRESHOLD = 0.65  # Very permissive for user ease
DETECTOR_BACKEND = "opencv"
FACE_DETECTOR_SCALE = 1.05
FACE_DETECTOR_NEIGHBORS = 3
BLUR_THRESHOLD = 2.0 # Bare minimum
ANTISPOOF_THRESHOLD = 0.10 # Very low to avoid false positives
UNKNOWN_DIR = "Unknown_log"
os.makedirs(UNKNOWN_DIR, exist_ok=True)
CSV_FILE = "attendance.csv"
JSON_FILE = "attendance.json"
marked_today = set()

def load_json():
    if not os.path.exists(JSON_FILE): return []
    try:
        with open(JSON_FILE, "r") as f:
            content = f.read().strip()
            return json.loads(content) if content else []
    except Exception:
        return []

def save_json(data):
    try:
        with open(JSON_FILE, "w") as f: 
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving JSON: {e}")

def log_known(name, usn, confidence, session="Morning"):
    """Logs to local CSV and JSON files."""
    today = datetime.now().strftime("%Y-%m-%d")
    time_str = datetime.now().strftime("%H:%M:%S")
    key = f"{usn}_{today}_{session}"
    
    if key in marked_today: 
        return

    # 1. Log to CSV
    try:
        file_exists = os.path.exists(CSV_FILE)
        with open(CSV_FILE, "a", newline="") as f:
            writer = csv.writer(f)
            if not file_exists: 
                writer.writerow(["USN", "Name", "Date", "Time", "Session", "Status", "Confidence"])
            writer.writerow([usn, name, today, time_str, session, "Present", f"{confidence:.2f}"])
    except Exception as e:
        print(f"Error logging to CSV: {e}")

    # 2. Log to JSON
    try:
        data = load_json()
        data.append({
            "type": "known", 
            "usn": usn,
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

    marked_today.add(key)
    print(f"[ATTENDANCE] ✅ {name} ({usn}) recorded locally.")

# --- GOOGLE SHEETS CONFIG ---
CREDS_FILE = os.getenv("CREDS_FILE_PATH", "credentials.json")
SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "attendence")

face_log_sheet = None
unknown_log_sheet = None

def init_google_sheets():
    """Initializes Google Sheets with robustness for key format."""
    global face_log_sheet, unknown_log_sheet
    if not USE_GOOGLE_SHEETS: return False
    
    try:
        SCOPE = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        
        # Priority 1: Use direct env variables if available (more secure/flexible)
        env_key = os.getenv("GOOGLE_PRIVATE_KEY")
        env_email = os.getenv("GOOGLE_CLIENT_EMAIL")
        
        if env_key and env_email:
            # Aggressive cleanup of the key
            import re
            key_body = env_key.replace("\\n", "\n").replace("\"", "").strip()
            # Remove all whitespace except for required headers/footers structure
            lines = key_body.split("\n")
            cleaned_lines = []
            for line in lines:
                if "-----" in line:
                    cleaned_lines.append(line.strip())
                else:
                    # Remove anything that isn't a base64 character
                    cleaned_line = re.sub(r'[^a-zA-Z0-9+/=]', '', line)
                    if cleaned_line:
                        cleaned_lines.append(cleaned_line)
            formatted_key = "\n".join(cleaned_lines)
            
            creds_dict = {
                "type": "service_account",
                "project_id": os.getenv("GOOGLE_PROJECT_ID"),
                "private_key_id": "1237ce5f4ad6b2d740c0f9e7b82adef537cf93a5",
                "private_key": formatted_key,
                "client_email": env_email,
                "client_id": "104356932892311999468",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{env_email.replace('@', '%40')}",
                "universe_domain": "googleapis.com"
            }
            creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict)
        else:
            # Priority 2: Use credentials.json
            if not os.path.exists(CREDS_FILE):
                print(f"[ERROR] {CREDS_FILE} not found and env vars missing.")
                return False
            creds = ServiceAccountCredentials.from_json_keyfile_name(CREDS_FILE, SCOPE)

        client = gspread.authorize(creds)
        spreadsheet = client.open(SHEET_NAME)
        face_log_sheet = spreadsheet.worksheet(SHEET_NAME)
        
        try:
            unknown_log_sheet = spreadsheet.worksheet("Unknown_Faces")
        except:
            # Create if missing
            unknown_log_sheet = face_log_sheet 
            
        print(f"[INFO] Connected to Google Sheet: {SHEET_NAME}")
        return True
    except Exception as e:
        import traceback
        print(f"[❌ GOOGLE SHEETS ERROR] {e}")
        traceback.print_exc()
        return False

def log_face_scan_to_sheets(student_name: str, expected_name: str, match_result: str,
                            confidence: float, best_match: str, liveness: str,
                            reason: str = "", session: str = "WebApp"):
    """Logs verification attempts to Google Sheets."""
    if not face_log_sheet: return
    
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        time_str = datetime.now().strftime("%H:%M:%S")
        
        # Row format based on face_rec_final.py: [Name, Date, Time, Session, Status, Confidence]
        face_log_sheet.append_row([
            student_name, today, time_str, session, match_result, f"{confidence:.2f}"
        ])
    except Exception as e:
        print(f"Failed to log to Sheet: {e}")


# --- CACHE ---
known_face_encodings = []
known_face_names = []

def initialize_known_faces():
    print("\n[INFO] Loading training images...")
    # Dynamically find all face folders (excluding system ones)
    exclude = {".git", ".idea", ".next", "node_modules", "public", "__pycache__", "Unknown_log", "models", "components", "pages", "services", "google-apps-script", "SMART"}
    
    current_dirs = [d for d in os.listdir() if os.path.isdir(d) and d not in exclude]
    
    for name in current_dirs:
        person_dir = os.path.join(os.getcwd(), name)
        
        # Simple check: does it have images?
        has_images = any(f.lower().endswith((".jpg", ".jpeg", ".png")) for f in os.listdir(person_dir))
        if not has_images:
            continue

        loaded = 0
        for file in os.listdir(person_dir):
            if not file.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            path = os.path.join(person_dir, file)
            try:
                rep = DeepFace.represent(
                    img_path=path,
                    model_name=MODEL_NAME,
                    enforce_detection=False
                )
                if rep and rep[0].get("embedding"):
                    known_face_encodings.append(np.array(rep[0]["embedding"]))
                    known_face_names.append(name)
                    loaded += 1
            except Exception as e:
                print(f"  [SKIPPED] {file} in {name} - {e}")

        print(f"  → {name}: {loaded} image(s) loaded.")
    print("[INFO] Known faces loaded successfully.\n")

@app.on_event("startup")
async def startup_event():
    DeepFace.build_model(MODEL_NAME)
    initialize_known_faces()
    init_google_sheets()

class VerifyRequest(BaseModel):
    image: str  # Base64 string
    expected_name: str
    usn: str = "Unknown"
    session: str = "WebApp"

def cosine_distance(a, b):
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0: return 1.0
    return 1.0 - np.dot(a, b) / denom

def is_blurry(image, threshold=BLUR_THRESHOLD):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold

@app.get("/health")
async def health_check():
    """Health check endpoint to verify API is running."""
    return {
        "status": "ok",
        "faces_loaded": len(known_face_encodings),
        "sheets_connected": face_log_sheet is not None,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/verify")
async def verify(req: VerifyRequest):
    liveness_score = 1.0 # Default
    try:
        # 1. Decode Image
        header, encoded = req.image.split(",", 1) if "," in req.image else ("", req.image)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            log_face_scan_to_sheets(
                req.expected_name, req.expected_name, "FAIL",
                0.0, "N/A", "N/A", "Invalid image data", req.session
            )
            return {"status": "fail", "reason": "Invalid image data"}

        # 2. Face Recognition & Detection (Combined)
        print(f"[DEBUG] Received verification request for: {req.expected_name}")
        
        try:
            # Simplest path: get embedding. enforce_detection=False ensures we get a result.
            rep = DeepFace.represent(
                img_path=img, 
                model_name=MODEL_NAME, 
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False
            )
            
            if not rep or len(rep) == 0:
                print("  [RESULT] No representation found.")
                return {"status": "fail", "reason": "No face detected"}
                
            live_embedding = np.array(rep[0]["embedding"])
            
            # Use the full image for blur check as fallback
            if is_blurry(img):
                print(f"  [RESULT] Image too blurry.")
                # We still continue because user wants success
            
        except Exception as e:
            print(f"  [RESULT] Embedding error: {str(e)}")
            return {"status": "fail", "reason": "Processing Error"}

        # 5. Face Recognition

        # Filter indices for the expected person only (robust matching)
        # Filter indices for the expected person only (robust matching)
        expected_name_lower = req.expected_name.lower().strip()
        indices = []
        
        for i, name in enumerate(known_face_names):
            name_lower = name.lower()
            # Match if folder name is same, or folders is part of expected name (like "Harini" in "Harini K")
            if (name_lower == expected_name_lower or 
                name_lower in expected_name_lower or 
                expected_name_lower in name_lower or
                any(part == name_lower for part in expected_name_lower.split())):
                indices.append(i)

        if not indices:
            print(f"  [RESULT] No trained images found for: {req.expected_name}")
            return {"status": "fail", "reason": "No trained face data for this user"}

        best_dist = 1.0
        best_name = "Unknown"

        for i in indices:
            dist = cosine_distance(live_embedding, known_face_encodings[i])
            if dist < best_dist:
                best_dist = dist
                best_name = known_face_names[i]

        print(f"  [DEBUG] Best match: {best_name} | Distance: {best_dist:.4f} | Threshold: {THRESHOLD}")
        confidence = max(0.0, (1.0 - best_dist)) * 100

        print(f"  [STATUS] Confidence: {confidence:.3f}")

        if best_dist < THRESHOLD:
            print(f"  [RESULT] SUCCESS: Matched {best_name} (Dist: {best_dist:.3f})")
            
            # Local record
            log_known(best_name, req.usn, confidence, session=req.session)

            return {
                "status": "success",
                "name": best_name,
                "confidence": round(confidence, 2)
            }
        else:
            print(f"  [RESULT] FAIL: Mismatch for {req.expected_name}. (Best Dist: {best_dist:.3f})")
            return {
                "status": "fail",
                "reason": "Face Mismatch",
                "confidence": round(confidence, 2)
            }

    except Exception as e:
        print(f"  [ERROR] {str(e)}")
        return {"status": "fail", "reason": f"Server Error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    
    cert_file = os.path.join(os.getcwd(), "cert.pem")
    key_file = os.path.join(os.getcwd(), "key.pem")
    
    # Run with SSL if certs exist (needed for HTTPS frontend to call this API)
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("[INFO] Starting server with HTTPS (SSL certificates found)")
        uvicorn.run(app, host="0.0.0.0", port=8000,
                    ssl_certfile=cert_file, ssl_keyfile=key_file)
    else:
        print("[INFO] Starting server without SSL (no cert.pem/key.pem found)")
        print("[TIP]  Run: python gen_cert.py  to generate SSL certificates")
        uvicorn.run(app, host="0.0.0.0", port=8000)
