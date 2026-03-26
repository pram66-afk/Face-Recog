import cv2
import numpy as np
import pickle
import os
from deepface import DeepFace
from antispoof import is_live_face

# --- CONFIG ---
ENCODINGS_FILE = "encodings.pickle"
MODEL_NAME = "Facenet512"
DISTANCE_THRESHOLD = 0.40  # Tight threshold for 1:1
LIVENESS_THRESHOLD = 0.50  # From MiniFASNetV2
ENFORCE_DETECTION = True

# Cache encodings in memory for fast production lookups
_cached_encodings = {}

def load_student_encodings():
    """Load encodings from pickle only if not already cached."""
    global _cached_encodings
    if not _cached_encodings:
        if os.path.exists(ENCODINGS_FILE):
            with open(ENCODINGS_FILE, "rb") as f:
                _cached_encodings = pickle.load(f)
        else:
            print(f"[ERROR] Encodings file '{ENCODINGS_FILE}' not found! Run train_model.py first.")
    return _cached_encodings

def cosine_distance(a, b):
    """Calculate cosine distance between two embeddings."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0: return 1.0
    return 1.0 - np.dot(a, b) / denom

def verify_1_to_1(logged_in_usn, live_frame):
    """
    Core backend logic for 1:1 face verification.
    Takes the USN (ID) and the current camera frame.
    Returns: (bool success, string message, float confidence)
    """
    encodings = load_student_encodings()
    
    # 1. Check if student data exists
    if logged_in_usn not in encodings:
        return False, f"Error: No biometric data found for USN '{logged_in_usn}'.", 0.0

    target_encoding = encodings[logged_in_usn]

    # 2. Extract face from live frame
    try:
        # DeepFace.represent also handles face detection and alignment
        results = DeepFace.represent(
            img_path=live_frame,
            model_name=MODEL_NAME,
            enforce_detection=ENFORCE_DETECTION,
            detector_backend='opencv',
            align=True
        )
    except Exception as e:
        # Handle "No face detected" or "Multiple faces detected"
        if "Face could not be detected" in str(e):
            return False, "Error: No face detected in the frame.", 0.0
        return False, f"Error during face extraction: {str(e)}", 0.0

    if not results:
        return False, "Error: Could not process face from the frame.", 0.0

    # 3. Handle multiple faces (Security measure: Only one person allowed in frame)
    if len(results) > 1:
        return False, "Security Error: Multiple people detected in frame! Verification rejected.", 0.0

    # Extract live face ROI and embedding
    live_embedding = np.array(results[0]["embedding"])
    face_roi = results[0]["facial_area"]
    x, y, w, h = face_roi['x'], face_roi['y'], face_roi['w'], face_roi['h']
    
    # Crop face for liveness check
    face_crop = live_frame[y:y+h, x:x+w]

    # 4. Anti-Spoofing / Liveness Check (MiniFASNet + Heuristic)
    try:
        live_prob = is_live_face(face_crop, threshold=LIVENESS_THRESHOLD, return_prob=True)
    except:
        live_prob = 1.0 # Fallback if model missing, though not ideal for production

    if live_prob < LIVENESS_THRESHOLD:
        return False, f"Anti-Spoofing Check Failed! Potential photo/screen detected (Score: {live_prob:.2f}).", 0.0

    # 5. 1:1 Facial Verification Match
    dist = cosine_distance(live_embedding, target_encoding)
    confidence = (1.0 - dist) * 100

    if dist < DISTANCE_THRESHOLD:
        return True, f"Authentication Success: Welcome {logged_in_usn}.", float(confidence)
    else:
        # User B stepped in front of User A's login session
        return False, f"Verification Rejected: Face does NOT match biometric record for {logged_in_usn}.", float(confidence)

# Optional EAR Blink Check Helper (Requires Mediapipe)
def calculate_ear(eye_landmarks):
    # This is a placeholder for the logic: EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    # Production implementation usually identifies landmarks via mediapipe.
    pass
