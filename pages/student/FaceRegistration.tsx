
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { apiPost } from '../../services/api';
import { getCurrentUser } from '../../services/auth';

const FaceRegistration: React.FC = () => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState('Loading AI models...');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const u = getCurrentUser();
        if (!u) { navigate('/'); return; }
        setUser(u);
        loadModels();
    }, []);

    const loadModels = async () => {
        try {
            const MODEL_URL = '/models';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            setModelLoaded(true);
            setStatus('Models Loaded. Starting Camera...');
            startVideo();
        } catch (err) {
            console.error(err);
            setStatus('Failed to load AI models. Refresh page.');
        }
    };

    const startVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setLoading(false);
                setStatus('Position your face in the center.');
            })
            .catch(err => setStatus('Camera access denied.'));
    };

    const handleCapture = async () => {
        if (!videoRef.current || !modelLoaded) return;
        setStatus('Detecting face...');

        const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

        if (detections) {
            // We have a face!
            const descriptor = Array.from(detections.descriptor); // Convert Float32Array to normal array for JSON

            setStatus('Face detected! Saving to cloud...');

            try {
                const result = await apiPost('registerFace', {
                    usn: user.usn || user.id, // Assuming USN is ID or stored in user object
                    descriptor: descriptor
                });

                if (result.success) {
                    alert('Face Registered Successfully!');
                    navigate('/student-dashboard');
                } else {
                    setStatus('Upload failed: ' + result.error);
                }
            } catch (err) {
                setStatus('Server error during upload.');
            }
        } else {
            setStatus('No face detected. Try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-purple-700">Face Registration</h2>
                <p className="mb-4 text-gray-600">{status}</p>

                <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden mb-4">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                </div>

                <button
                    onClick={handleCapture}
                    disabled={loading || !modelLoaded}
                    className={`w-full py-3 rounded-lg text-white font-bold transition-colors ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                >
                    {loading ? 'Starting Camera...' : 'Capture & Register'}
                </button>

                <button
                    onClick={() => navigate('/student-dashboard')}
                    className="mt-4 text-sm text-gray-500 hover:text-gray-700"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default FaceRegistration;
