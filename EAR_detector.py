import cv2
import numpy as np

def calculate_ear(eye_landmarks):
    """
    Computes the Eye Aspect Ratio (EAR) given 6 landmarks for one eye.
    Standardized landmark indices for EAR:
    P1 (left), P2 (top-left), P3 (top-right), P4 (right), P5 (bottom-right), P6 (bottom-left)
    Equation: EAR = (||P2-P6|| + ||P3-P5||) / (2 * ||P1-P4||)
    """
    # Vertical distances
    v1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
    v2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
    # Horizontal distance
    h = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
    
    if h == 0: return 0
    return (v1 + v2) / (2.0 * h)

class BlinkDetector:
    def __init__(self, ear_threshold=0.2, consecutive_frames=3):
        self.ear_threshold = ear_threshold
        self.consecutive_frames = consecutive_frames
        self.blink_counter = 0
        self.total_blinks = 0
        self.is_blinked = False

    def update(self, ear):
        if ear < self.ear_threshold:
            self.blink_counter += 1
        else:
            if self.blink_counter >= self.consecutive_frames:
                self.total_blinks += 1
                self.is_blinked = True
            self.blink_counter = 0
            
    def reset(self):
        self.is_blinked = False

# --- Integration Example with Mediapipe (Preferred) ---
# pip install mediapipe
# 
# try:
#     import mediapipe as mp
#     mp_face_mesh = mp.solutions.face_mesh
#     face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True)
# except ImportError:
#     face_mesh = None

def get_live_liveness_score(frame):
    """
    Placeholder for live blink detection.
    In a high-trust system, you'd process a stream of 10-20 frames
    to detect a blink before returning True.
    """
    # For now, we return True as we're using MiniFASNet for liveness
    return True
