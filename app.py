from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
import cv2
import numpy as np
import base64
import os
from verification import verify_1_to_1, MODEL_NAME
from deepface import DeepFace

app = FastAPI(title="Production-Ready Attendance API")

@app.on_event("startup")
async def startup_event():
    """Build the face recognition model on startup for speed."""
    print(f"[INFO] Building face recognition model: {MODEL_NAME}...")
    DeepFace.build_model(MODEL_NAME)
    print(f"[INFO] Model ready.")

class VerificationRequest(BaseModel):
    usn: str
    image: str  # Base64 encoded frame from camera

@app.post("/verify-attendance")
async def verify_attendance(req: VerificationRequest):
    """
    Production endpoint for 1:1 face verification + Anti-Spoofing.
    Flow: 1. Decode Image -> 2. Load Student Encoding -> 3. Liveness Check -> 4. 1:1 Match
    """
    try:
        # 1. Decode Base64 image
        if "," in req.image:
            header, encoded = req.image.split(",", 1)
        else:
            encoded = req.image
            
        try:
            image_bytes = base64.b64decode(encoded)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as decode_err:
            raise HTTPException(status_code=400, detail="Invalid image encoding.")

        if frame is None:
            raise HTTPException(status_code=400, detail="Failed to decode image.")

        # 2. Call the 1:1 Verification Logic from verification.py
        # This handles:
        # - Loading specific encoding for 'usn'
        # - Detecting exactly ONE face
        # - Running MiniFASNet anti-spoofing
        # - Comparing distance against the 1:1 reference
        success, message, confidence = verify_1_to_1(req.usn, frame)

        if success:
            return {
                "status": "success",
                "usn": req.usn,
                "message": message,
                "confidence": round(confidence, 2)
            }
        else:
            # We return 200 even on failure, but with status "rejected" 
            # so the frontend can display the specific error message (e.g., "Spoof detected")
            return {
                "status": "rejected",
                "usn": req.usn,
                "message": message,
                "confidence": round(confidence, 2)
            }

    except Exception as e:
        print(f"[ERROR] API Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.get("/health")
async def health():
    return {"status": "running", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    # Use 0.0.0.0 to allow external access (e.g. from mobile or frontend)
    uvicorn.run(app, host="0.0.0.0", port=8000)
