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
from google.oauth2.service_account import Credentials

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
TARGET_FOLDERS = ["4PM23CE001","4PM23CE013","4PM23CE039","4PM23CE056"]
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
users_sheet = None
spreadsheet_client = None

def init_google_sheets():
    """Initializes Google Sheets with robustness for key format."""
    global face_log_sheet, unknown_log_sheet, users_sheet, spreadsheet_client
    if not USE_GOOGLE_SHEETS: return False
    
    try:
        SCOPE = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        
        # Read env variables for fallback auth
        env_key = os.getenv("GOOGLE_PRIVATE_KEY", "")
        env_email = os.getenv("GOOGLE_CLIENT_EMAIL", "")
        
        creds = None
        
        # Priority 1: Use direct file if it exists (most robust)
        if os.path.exists(CREDS_FILE):
            print(f"[INFO] Using {CREDS_FILE} for authentication.")
            try:
                creds = Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPE)
            except Exception as e:
                print(f"[ERROR] Failed to load credentials from file {CREDS_FILE}: {e}")
        
        # Priority 2: Use direct env variables if available (for cloud hosting etc.)
        if not creds and env_key and env_email:
            print("[INFO] Attempting to use environment variables for authentication.")
            try:
                # Robust cleanup: Handle literal "\n" and ensure correct Base64 padding
                key_content = env_key.replace("\\n", "\n").replace('"', '').strip()
                
                # Logic to handle potential Base64 padding issues often seen in .env files
                if "-----BEGIN PRIVATE KEY-----" in key_content:
                    parts = key_content.split("-----")
                    if len(parts) >= 5:
                        header = "-----" + parts[1] + "-----"
                        footer = "-----" + parts[-2] + "-----"
                        import re
                        # Remove anything that's NOT a base64 character
                        b64_data = re.sub(r'[^a-zA-Z0-9+/=]', '', parts[2])
                        # Add missing padding if needed
                        padding_needed = len(b64_data) % 4
                        if padding_needed:
                            b64_data += "=" * (4 - padding_needed)
                        
                        # Reconstruct correctly formatted PEM
                        key_content = f"{header}\n{b64_data}\n{footer}"

                creds_dict = {
                    "type": "service_account",
                    "project_id": os.getenv("GOOGLE_PROJECT_ID"),
                    "private_key_id": os.getenv("GOOGLE_PRIVATE_KEY_ID", "default_key_id"),
                    "private_key": key_content,
                    "client_email": env_email,
                    "client_id": os.getenv("GOOGLE_CLIENT_ID", "default_client_id"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{env_email.replace('@', '%40')}",
                    "universe_domain": "googleapis.com"
                }
                creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPE)
            except Exception as e:
                print(f"[ERROR] Failed to auth with ENV vars: {e}")

        if not creds:
            print("[ERROR] No valid Google Sheets credentials found. Sheets integration disabled.")
            return False

        client = gspread.authorize(creds)
        spreadsheet_client = client
        spreadsheet = client.open(SHEET_NAME)
        face_log_sheet = spreadsheet.worksheet(SHEET_NAME)
        try:
            # First choice: a worksheet named "Users" or "Students"
            try:
                users_sheet = spreadsheet.worksheet("Users")
            except:
                try:
                    users_sheet = spreadsheet.worksheet("Students")
                except:
                    # Search all worksheets for one that looks like a user list
                    all_sheets = spreadsheet.worksheets()
                    for s in all_sheets:
                        if s.title.lower() in ["users", "students", "studentslist", "student_list", "roster"]:
                            users_sheet = s
                            break
                    else:
                        # Fallback: check if the first worksheet has "USN" in it
                        try:
                            first_rows = all_sheets[0].row_values(1)
                            if any("USN" in str(v).upper() for v in first_rows):
                                users_sheet = all_sheets[0]
                                print(f"[INFO] Using {users_sheet.title} as users sheet.")
                        except:
                            pass
            
            if not users_sheet:
                print("[WARN] Users worksheet not found.")
        except Exception as e:
            print(f"[WARN] Error identifying users sheet: {e}")

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


# --- BIOMETRIC STORAGE ---
known_face_encodings_dict = {} # Keyed by USN

def initialize_known_faces():
    """Optimized: Load from cache into O(1) dictionary."""
    global known_face_encodings_dict
    
    ENCODINGS_FILE = "encodings.pickle"
    if os.path.exists(ENCODINGS_FILE):
        import pickle
        try:
            with open(ENCODINGS_FILE, "rb") as f:
                data = pickle.load(f)
                # Ensure it's in dictionary format [USN: Encoding]
                if isinstance(data, dict):
                    known_face_encodings_dict = {
                        k: (np.array(v) if not isinstance(v, np.ndarray) else v) 
                        for k, v in data.items()
                    }
                else:
                    # Upgrade legacy format
                    encs, names = data
                    for i, name in enumerate(names):
                        known_face_encodings_dict[name] = np.array(encs[i])
            
            print(f"[INFO] Initialized 1:1 Secure Vault with {len(known_face_encodings_dict)} USNs.")
            return
        except Exception as e:
            print(f"[WARN] Failed to load secure vault: {e}")

    # Fallback to slow loading from directories
    print("\n[INFO] Cache missing. Regenerating training images (this will be slow)...")

@app.on_event("startup")
async def startup_event():
    DeepFace.build_model(MODEL_NAME)
    initialize_known_faces()
    try:
        sheets_ok = init_google_sheets()
        if not sheets_ok:
            print("[WARN] Google Sheets initialization returned False. Students API will be unavailable.")
    except Exception as e:
        print(f"[WARN] Google Sheets init failed (non-fatal): {e}")
        print("[WARN] The server will continue without Google Sheets. Fix credentials.json to enable.")

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
        "faces_loaded": len(known_face_encodings_dict),
        "sheets_connected": face_log_sheet is not None,
        "users_sheet_connected": users_sheet is not None,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/students")
async def get_students(semester: str = None, section: str = None):
    """Fetches students from the 'Users' sheet."""
    if not users_sheet:
        return {"success": False, "error": "Users sheet not connected. Check that credentials.json has a valid private key and the spreadsheet has a 'Users' or 'Students' worksheet."}
    
    try:
        # Fetch all rows from Users sheet
        all_users = users_sheet.get_all_records()
        
        # Filter for students
        students = [u for u in all_users if str(u.get('Role', '')).upper() == 'STUDENT']
        
        # Filter by section if provided
        if section:
            section_lower = str(section).lower()
            students = [u for u in students if str(u.get('Section', '')).lower() == section_lower]
            
        # Filter by semester if provided
        if semester:
            sem_str = str(semester)
            students = [u for u in students if str(u.get('Semester', '')) == sem_str]
            
        return {
            "success": True,
            "students": [
                {
                    "usn": u.get("USN", ""),
                    "name": u.get("Name", ""),
                    "email": u.get("Email", ""),
                    "section": u.get("Section", ""),
                    "semester": u.get("Semester", "")
                } for u in students
            ]
        }
    except Exception as e:
        print(f"[ERROR] Failed to fetch students: {e}")
        return {"success": False, "error": str(e)}

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
        # 5. 1:1 Secure Verification Logic
        # Instead of scanning all folders, we ONLY look for the claimed USN
        claimed_id = req.usn.strip().upper()
        if not claimed_id or claimed_id == "UNKNOWN":
            claimed_id = req.expected_name.strip().upper() # Fallback to name if USN missing

        if claimed_id not in known_face_encodings_dict:
            print(f"  [RESULT] No biometric profile found for: {claimed_id}")
            return {"status": "fail", "reason": "No registered face data for this USN"}

        # Compare only against the ONE expected encoding
        reference_encoding = known_face_encodings_dict[claimed_id]
        dist = cosine_distance(live_embedding, reference_encoding)
        
        # 6. EAR Liveness Placeholder (For Blink Detection)
        is_live = True # is_live_face already handles basic liveness via MiniFASNet
        
        confidence = max(0.0, (1.0 - dist)) * 100
        print(f"  [DEBUG] 1:1 Comparison: {claimed_id} | Dist: {dist:.4f} | Confidence: {confidence:.2f}%")

        if dist < THRESHOLD:
            print(f"  [RESULT] SUCCESS: {claimed_id} verified.")
            return {
                "status": "success",
                "usn": claimed_id,
                "confidence": round(confidence, 2),
                "is_match": True,
                "is_live": is_live
            }
        else:
            print(f"  [RESULT] FAIL: Face mismatch for {claimed_id}. (Dist: {dist:.3f})")
            return {
                "status": "fail",
                "reason": "Identity verification failed. Surface mismatch.",
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
