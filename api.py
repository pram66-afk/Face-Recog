from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import base64
import os
import uuid
import time
from datetime import datetime
from pydantic import BaseModel
from deepface import DeepFace
from antispoof import is_live_face
from dotenv import load_dotenv

# Load env variables
load_dotenv()

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
THRESHOLD = 0.40
BLUR_THRESHOLD = 10.0
ANTISPOOF_THRESHOLD = 0.15
UNKNOWN_DIR = "Unknown_log"
os.makedirs(UNKNOWN_DIR, exist_ok=True)

# --- CACHE ---
known_face_encodings = []
known_face_names = []

def initialize_known_faces():
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
            except Exception as e:
                print(f"  [SKIPPED] {file} in {name} - {e}")

        print(f"  → {name}: {loaded} image(s) loaded.")
    print("[INFO] Known faces loaded successfully.\n")

@app.on_event("startup")
async def startup_event():
    DeepFace.build_model(MODEL_NAME)
    initialize_known_faces()

class VerifyRequest(BaseModel):
    image: str  # Base64 string
    expected_name: str

def cosine_distance(a, b):
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0: return 1.0
    return 1.0 - np.dot(a, b) / denom

def is_blurry(image, threshold=BLUR_THRESHOLD):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold

@app.post("/verify")
async def verify(req: VerifyRequest):
    try:
        # 1. Decode Image
        header, encoded = req.image.split(",", 1) if "," in req.image else ("", req.image)
        nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"status": "fail", "reason": "Invalid image data"}

        # 2. Check for faces
        print(f"[DEBUG] Received verification request for: {req.expected_name}")
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)

        if len(faces) == 0:
            print(f"  [RESULT] No face detected.")
            return {"status": "fail", "reason": "No face detected"}

        # Use the first face detected
        (x, y, w, h) = faces[0]
        face_img = img[y:y+h, x:x+w]

        # 3. Blur Check
        if is_blurry(face_img):
            return {"status": "fail", "reason": "Image too blurry"}

        # 4. Anti-Spoofing
        try:
            live_prob = is_live_face(face_img, threshold=ANTISPOOF_THRESHOLD, return_prob=True)
            if live_prob < ANTISPOOF_THRESHOLD:
                return {"status": "fail", "reason": "Spoof Detected", "confidence": round(live_prob * 100, 2)}
        except Exception as e:
            print(f"Anti-spoof error: {e}")
            # Fallback or strict fail? Let's fallback to live for now if model fails
            pass

        # 5. Face Recognition
        try:
            rep = DeepFace.represent(img, model_name=MODEL_NAME, enforce_detection=False)
            live_embedding = np.array(rep[0]["embedding"])
        except Exception as e:
            return {"status": "fail", "reason": f"Face recognition error: {str(e)}"}

        best_dist = 1.0
        best_name = "Unknown"

        for i, known in enumerate(known_face_encodings):
            dist = cosine_distance(live_embedding, known)
            if dist < best_dist:
                best_dist = dist
                best_name = known_face_names[i]

        confidence = max(0.0, (1.0 - best_dist)) * 100

        if best_dist < THRESHOLD and best_name.lower() == req.expected_name.lower():
            print(f"  [RESULT] SUCCESS: Matched {best_name} (Dist: {best_dist:.3f})")
            return {
                "status": "success",
                "name": best_name,
                "confidence": round(confidence, 2)
            }
        else:
            print(f"  [RESULT] FAIL: Mismatch. Best match: {best_name} (Dist: {best_dist:.3f})")
            return {
                "status": "fail",
                "reason": "Face Mismatch",
                "identity": best_name if best_dist < THRESHOLD else "Unknown",
                "confidence": round(confidence, 2)
            }

    except Exception as e:
        return {"status": "fail", "reason": f"Server Error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
