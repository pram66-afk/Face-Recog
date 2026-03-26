import os
import pickle
import numpy as np
from deepface import DeepFace
from tqdm import tqdm

# --- CONFIG ---
DATASET_DIR = "dataset"
ENCODINGS_FILE = "encodings.pickle"
MODEL_NAME = "Facenet512"

def generate_encodings():
    """
    Iterates through dataset/USN_ID/*.jpg, generates embeddings, 
    and saves them as a serialized USN-keyed dictionary.
    """
    if not os.path.exists(DATASET_DIR):
        print(f"[ERROR] Dataset directory '{DATASET_DIR}' not found. Please create it and add USN folders.")
        # Exclude known non-dataset directories
        IGNORED_DIRS = {".git", ".idea", ".next", "node_modules", "Unknown_log", "__pycache__", "SMART", "dist", "public", "services", "utils", "components", "pages", "models", "google-apps-script"}
        folders = [f for f in os.listdir('.') if os.path.isdir(f) and f not in IGNORED_DIRS and not f.startswith('.')]
        if not folders:
            return
        print(f"[INFO] Scanning individual folders: {folders}")
        dataset_path = "."
    else:
        dataset_path = DATASET_DIR
        folders = os.listdir(dataset_path)

    known_encodings = {}

    print(f"\n[INFO] Starting Training Phase (Model: {MODEL_NAME})...")
    
    for usn_id in tqdm(folders, desc="Processing Students"):
        person_dir = os.path.join(dataset_path, usn_id)
        if not os.path.isdir(person_dir) or usn_id in ["__pycache__", ".git", ".idea", ".next", "node_modules", "Unknown_log"]:
            continue

        images = [f for f in os.listdir(person_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        if not images:
            continue

        # We take the first high-quality face found for a clear reference
        # or we could average multiple embeddings for robustness.
        # For 1:1, a single good reference is often sufficient, but multiple is better.
        embeddings = []
        for img_name in images:
            img_path = os.path.join(person_dir, img_name)
            try:
                # DeepFace.represent returns a list of dictionaries (one per face)
                results = DeepFace.represent(
                    img_path=img_path, 
                    model_name=MODEL_NAME, 
                    enforce_detection=True, 
                    detector_backend='opencv'
                )
                if results:
                    embeddings.append(results[0]["embedding"])
            except Exception as e:
                # print(f"  [SKIPPED] {img_name}: {e}")
                pass

        if embeddings:
            # Store the mean embedding for robustness
            known_encodings[usn_id] = np.mean(embeddings, axis=0)

    # Save to serialized pickle file
    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump(known_encodings, f)
    
    print(f"\n[SUCCESS] Saved {len(known_encodings)} student encodings to '{ENCODINGS_FILE}'.")

if __name__ == "__main__":
    generate_encodings()
