import cv2
import os

# --- INSERTED: Suppress TensorFlow Info & Warnings ---
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
# -----------------------------------------------------

import numpy as np
import csv
import json
import uuid
import time
from datetime import datetime
from deepface import DeepFace
from antispoof import is_live_face

# --- INSERTED: Load secure .env variables ---
from dotenv import load_dotenv

load_dotenv()
# --------------------------------------------

# Google Sheets
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# ========================= CONFIG =========================
TARGET_FOLDERS = ["4PM23CE001","4PM23CE013","4PM23CE039","4PM23CE056"]
MODEL_NAME = "Facenet512"
THRESHOLD = 0.45
FRAME_SKIP = 2
SESSION = "Morning"

BLUR_THRESHOLD = 10.0
ANTISPOOF_THRESHOLD = 0.15
MIN_FACE_SIZE = 50

CSV_FILE = "attendance.csv"
JSON_FILE = "attendance.json"
UNKNOWN_DIR = "Unknown_log"

# --- INSERTED: Fetching credentials from .env file ---
# (It defaults to the standard names if the .env file isn't found)
CREDS_FILE = os.getenv("CREDS_FILE_PATH", "credentials.json")
SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "attendence")
# -----------------------------------------------------

os.makedirs(UNKNOWN_DIR, exist_ok=True)

# ========================= GOOGLE SHEETS =========================
known_sheet = None
unknown_sheet = None

try:
    SCOPE = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]
    CREDS = ServiceAccountCredentials.from_json_keyfile_name(CREDS_FILE, SCOPE)
    client = gspread.authorize(CREDS)

    # --- INSERTED: Using the secure sheet name ---
    spreadsheet = client.open(SHEET_NAME)
    known_sheet = spreadsheet.worksheet(SHEET_NAME)
    # ---------------------------------------------

    unknown_sheet = spreadsheet.worksheet("Unknown_Faces")
    print("[INFO] Connected to Google Sheets successfully.")
except Exception as e:
    print(f"\n[❌ GOOGLE SHEETS ERROR] Connection failed! Reason: {e}\n")

# ========================= INITIALIZE DEEPFACE =========================
print("[INFO] Initializing DeepFace model — please wait...")
DeepFace.build_model(MODEL_NAME)
print(f"[INFO] Model '{MODEL_NAME}' ready.")

# ========================= TRAINING PHASE =========================
known_face_encodings = []
known_face_names = []

print("\n[INFO] Loading training images...")
for name in TARGET_FOLDERS:
    person_dir = os.path.join(os.getcwd(), name)
    if not os.path.exists(person_dir):
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
                enforce_detection=True
            )
            if rep and rep[0].get("embedding"):
                known_face_encodings.append(np.array(rep[0]["embedding"]))
                known_face_names.append(name)
                loaded += 1
                print(f"  ✔  {name} — {file}")
        except Exception as e:
            print(f"  [SKIPPED] {file} → {e}")

    print(f"  → {name}: {loaded} image(s) loaded.\n")

if not known_face_encodings:
    print("[ERROR] No training faces loaded. Check your TARGET_FOLDERS.")
    exit(1)

# ========================= GLOBALS & HELPERS =========================
marked_today = set()
unknown_embeddings = []


def load_json():
    if not os.path.exists(JSON_FILE): return []
    try:
        with open(JSON_FILE, "r") as f:
            content = f.read().strip()
            return json.loads(content) if content else []
    except json.JSONDecodeError:
        return []


def save_json(data):
    with open(JSON_FILE, "w") as f: json.dump(data, f, indent=4)


def cosine_distance(a, b):
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0: return 1.0
    return 1.0 - np.dot(a, b) / denom


def save_unknown_image(face):
    name = f"Unknown_{uuid.uuid4().hex}.jpg"
    path = os.path.join(UNKNOWN_DIR, name)
    cv2.imwrite(path, face)
    return name


def is_duplicate_unknown(embedding, threshold=0.25):
    for e in unknown_embeddings:
        if cosine_distance(embedding, e) < threshold: return True
    return False


def is_blurry(image, threshold=BLUR_THRESHOLD):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold


# ========================= LOGGING =========================
def log_known(name, confidence):
    today, time_str = datetime.now().strftime("%Y-%m-%d"), datetime.now().strftime("%H:%M:%S")
    key = f"{name}_{today}"
    if key in marked_today: return

    file_exists = os.path.exists(CSV_FILE)
    with open(CSV_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        if not file_exists: writer.writerow(["Name", "Date", "Time", "Session", "Status", "Confidence"])
        writer.writerow([name, today, time_str, SESSION, "Present", f"{confidence:.2f}"])

    data = load_json()
    data.append(
        {"type": "known", "name": name, "date": today, "time": time_str, "session": SESSION, "status": "Present",
         "confidence": round(confidence, 2)})
    save_json(data)

    if known_sheet is not None:
        try:
            known_sheet.append_row([name, today, time_str, SESSION, "Present", f"{confidence:.2f}"])
        except:
            pass

    marked_today.add(key)
    print(f"[ATTENDANCE] ✅ {name} marked Present")


def log_unknown(image_name):
    date_str, time_str = datetime.now().strftime("%Y-%m-%d"), datetime.now().strftime("%H:%M:%S")
    data = load_json()
    data.append(
        {"type": "unknown", "date": date_str, "time": time_str, "session": SESSION, "reason": "Face not recognized",
         "image_name": image_name})
    save_json(data)

    if unknown_sheet is not None:
        try:
            unknown_sheet.append_row([date_str, time_str, SESSION, "Face not recognized", image_name])
        except:
            pass


# ========================= MAIN VERIFICATION =========================
def verify_student_face(expected_name, timeout=15):
    print(f"\n[INFO] Starting Face Verification for: {expected_name}  (timeout: {timeout}s)")

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened(): cap = cv2.VideoCapture(0)
    if not cap.isOpened(): return False

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    start_time = time.time()
    frame_count = 0
    verification_successful = False

    while (time.time() - start_time) < timeout:
        ret, frame = cap.read()
        if not ret: break

        frame_count += 1
        display_frame = frame.copy()

        if frame_count % FRAME_SKIP != 0:
            cv2.imshow("Dual Auth - Face Verification", display_frame)
            if cv2.waitKey(1) & 0xFF == ord("q"): break
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(80, 80))

        for (x, y, w, h) in faces:
            pad = 20
            y1, y2 = max(0, y - pad), min(frame.shape[0], y + h + pad)
            x1, x2 = max(0, x - pad), min(frame.shape[1], x + w + pad)
            face_for_rec = frame[y1:y2, x1:x2]

            if face_for_rec is None or face_for_rec.size == 0:
                continue

            if face_for_rec.shape[0] < MIN_FACE_SIZE or face_for_rec.shape[1] < MIN_FACE_SIZE:
                continue

            if is_blurry(face_for_rec):
                cv2.putText(display_frame, "Hold Still (Blurry)", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                            (0, 165, 255), 2)
                continue

            # ---------------- ANTI SPOOFING ----------------
            try:
                live_prob = is_live_face(face_for_rec, threshold=ANTISPOOF_THRESHOLD, return_prob=True)
            except:
                live_prob = 1.0

            print(f"[DEBUG] Liveness Score: {live_prob:.3f} (Needs > {ANTISPOOF_THRESHOLD})")

            if live_prob < ANTISPOOF_THRESHOLD:
                cv2.rectangle(display_frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
                cv2.putText(display_frame, f"SPOOF ({live_prob:.2f})", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                            (0, 0, 255), 2)
                continue

            # ---------------- FACE RECOGNITION ----------------
            try:
                rep = DeepFace.represent(face_for_rec, model_name=MODEL_NAME, enforce_detection=False)
                live_embedding = np.array(rep[0]["embedding"])
            except:
                continue

            best_dist = 1.0
            best_name = "Unknown"

            for i, known in enumerate(known_face_encodings):
                dist = cosine_distance(live_embedding, known)
                if dist < best_dist:
                    best_dist = dist
                    best_name = known_face_names[i]

            confidence = max(0.0, (1.0 - best_dist)) * 100

            print(f"[DEBUG] AI Sees: {best_name} | Distance: {best_dist:.4f} (Needs < {THRESHOLD})")

            if best_dist < THRESHOLD:
                color = (0, 255, 0)
                label = f"{best_name} ({confidence:.1f}%)"
                cv2.rectangle(display_frame, (x, y), (x + w, y + h), color, 2)
                cv2.putText(display_frame, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

                if best_name.lower() == expected_name.lower():
                    log_known(best_name, confidence)
                    verification_successful = True
                    cv2.putText(display_frame, "✔ AUTH SUCCESS!", (x, y - 38), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                                (0, 255, 0), 2)
                    cv2.imshow("Dual Auth - Face Verification", display_frame)
                    cv2.waitKey(1500)
                    break
            else:
                cv2.rectangle(display_frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
                cv2.putText(display_frame, "Unknown", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        cv2.imshow("Dual Auth - Face Verification", display_frame)
        if verification_successful or (cv2.waitKey(1) & 0xFF == ord("q")):
            break

    cap.release()
    cv2.destroyAllWindows()

    if verification_successful:
        print(f"[SUCCESS] ✅ {expected_name} verified successfully.")
        return True
    else:
        print(f"[FAILED]  ❌ Could not verify {expected_name} within {timeout}s.")
        return False


# ========================= STANDALONE TEST =========================
if __name__ == "__main__":
    test_student = "Pramath"
    print(f"\n[TEST MODE] Running standalone face verification for: {test_student}")
    result = verify_student_face(expected_name=test_student, timeout=30)
    print(f"\nFinal Result for {test_student}: {'PASS ✅' if result else 'FAIL ❌'}")