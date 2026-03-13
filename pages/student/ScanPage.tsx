
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, XCircle } from 'lucide-react';
import jsQR from 'jsqr';
import { User } from '../../types';
import { AuthUser } from '../../services/auth';
import { isApiConfigured, verifyFace } from '../../services/api';
import { markAttendance } from '../../services/attendance';
import { getActiveSession, Session } from '../../services/sessions';

type ScanStage = 'PERMISSION' | 'CAMERA' | 'PROCESSING' | 'FACE_VERIFY' | 'RESULT';
type ScanResult = 'SUCCESS' | 'FAIL_TIMEOUT' | 'FAIL_INVALID_QR' | 'FAIL_DUPLICATE' | 'FAIL_ERROR';

interface ScanPageProps {
  user: User | null;
  authUser: AuthUser | null;
}


const ScanPage: React.FC<ScanPageProps> = ({ user, authUser }) => {
  const navigate = useNavigate();
  const apiReady = isApiConfigured();
  const [stage, setStage] = useState<ScanStage>('CAMERA');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resultMessage, setResultMessage] = useState<string>('');
  const [markedSubjectName, setMarkedSubjectName] = useState<string>('');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const qrTokenRef = useRef<string>('');

  // Face AI State
  const [faceStatus, setFaceStatus] = useState('Ready for camera...');

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const isVerifyingRef = useRef(false);
  const isScanningRef = useRef(false);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  }, []);


  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startLiveCamera = async () => {
    setCameraError('');
    setDebugInfo('');
    try {
      const idealFacingMode = stage === 'FACE_VERIFY' ? 'user' : 'environment';
      let stream;
      
      try {
        setDebugInfo(`Attempting: ${idealFacingMode} camera...`);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: idealFacingMode } }
        });
      } catch (err: any) {
        setDebugInfo(`Constraint failed: ${err.name}. Trying basic video...`);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      setDebugInfo('Camera connected successfully.');
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setCameraActive(true);
          // Start scanning loops
          if (stage === 'CAMERA') {
            scanIntervalRef.current = window.setInterval(() => { scanFrame(); }, 250);
          } else if (stage === 'FACE_VERIFY') {
            scanIntervalRef.current = window.setInterval(() => { verifyFaceFrame(); }, 500);
          }
        } catch (playErr: any) {
          setCameraError(`Playback Error: ${playErr.message}`);
        }
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      // Handle the most common error names for the user
      let msg = 'Camera access denied.';
      if (err.name === 'NotAllowedError') msg = 'Camera permission blocked. Check browser settings.';
      if (err.name === 'NotFoundError') msg = 'No camera found on this device.';
      if (err.name === 'NotReadableError') msg = 'Camera is already in use by another app.';
      
      setCameraError(msg);
      setDebugInfo(`Error: ${err.name} - ${err.message}`);
      setCameraActive(false);
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || isScanningRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    isScanningRef.current = true;
    try {
      const canvas = canvasRef.current;
      // Force smaller canvas for QR scanning performance (max 640px)
      const scale = Math.min(1.0, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data) {
        if (window.navigator.vibrate) window.navigator.vibrate(200);
        stopCamera();
        setStage('PROCESSING');
        handleAttendanceMarking(code.data);
      }
    } catch (e) {
      console.error('QR Scan error:', e);
    } finally {
      isScanningRef.current = false;
    }
  };

  const verifyFaceFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    // Use a flag to avoid multiple concurrent API calls
    if (stage !== 'FACE_VERIFY' || result !== null || isVerifyingRef.current) return;

    isVerifyingRef.current = true;
    try {
      const canvas = canvasRef.current;
      // Downscale to 480p for faster face recognition processing
      const scale = Math.min(1.0, 480 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.7);

      setFaceStatus('Verifying Identity...');
      const studentName = authUser?.name || user?.name || '';
      if (!studentName) throw new Error("Student data missing.");
      
      console.log(`Sending face verification for ${studentName}...`);
      const res = await verifyFace(base64Image, studentName);

      if (res.status === 'success') {
        // --- SECURE MARKING ---
        // Only mark in DB after face matches!
        if (apiReady && activeSession) {
          const markRes = await markAttendance({
            usn: authUser?.usn || authUser?.id || '',
            studentName: studentName,
            sessionId: activeSession.sessionId,
            token: qrTokenRef.current
          });

          if (!markRes.success) {
            setResult('FAIL_ERROR');
            setResultMessage(markRes.error || markRes.message || 'Marking failed');
            setStage('RESULT');
            stopCamera();
            return;
          }
        }

        stopCamera();
        setStage('RESULT');
        setResult('SUCCESS');
        setResultMessage(markedSubjectName);
      } else {
        setFaceStatus(`Fail: ${res.reason || 'Not matched'}`);
        // If it's a spoof or mismatch, we can keep looking or stop.
        // Let's keep looking until timeout or user quits.
        if (res.reason === 'Spoof Detected') {
          setResultMessage('Spoof Attempt Detected!');
        }
      }
    } catch (err: any) {
      console.error('Face verification error:', err);
      setFaceStatus(`API Error: ${err.message || 'Check Connection'}`);
    } finally {
      isVerifyingRef.current = false;
    }
  };

  const startCamera = () => {
    setStage('CAMERA');
    startLiveCamera();
  };

  useEffect(() => {
    if (stage === 'CAMERA' || stage === 'FACE_VERIFY') startLiveCamera();
  }, [stage]);

  const handleAttendanceMarking = async (qrData: string) => {
    try {
      if (apiReady) {
        // 1. Validate Session & QR first
        const sessions = await getActiveSession({});
        if (sessions.length === 0) { setResult('FAIL_TIMEOUT'); setResultMessage('No active session found.'); setStage('RESULT'); return; }
        const matchingSession = sessions.find(s => s.token === qrData);
        if (!matchingSession) { setResult('FAIL_INVALID_QR'); setResultMessage('QR code has expired or is invalid.'); setStage('RESULT'); return; }

        setMarkedSubjectName(matchingSession.subjectName || 'Unknown Subject');
        setActiveSession(matchingSession);
        qrTokenRef.current = qrData;

        // 3. Prepare for Face Check (Handoff to Backend)
        setStage('FACE_VERIFY');
        // startLiveCamera will be triggered by useEffect [stage]

      } else {
        // Local mode fallback
        setResult('SUCCESS'); setMarkedSubjectName('Demo Subject'); setStage('RESULT');
      }
    } catch (err: any) {
      setResult('FAIL_ERROR');
      setResultMessage(err.message || 'Failed to mark attendance');
      setStage('RESULT');
    }
  };

  const ResultCard: React.FC<{
    icon: React.ReactNode; title: string; message: string;
    accent: string; buttonText: string; buttonAction: () => void;
    buttonStyle?: string;
  }> = ({ icon, title, message, accent, buttonText, buttonAction, buttonStyle }) => (
    <div className="text-center w-full max-w-sm mx-auto animate-scale-in">
      <div className={`p-6 sm:p-8 rounded-3xl bg-white shadow-xl`}>
        <div className={`w-16 h-16 rounded-2xl ${accent} flex items-center justify-center mx-auto mb-4`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        {result === 'SUCCESS' && (
          <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full mb-4 inline-block">
            Verified by QR & Face ID
          </p>
        )}
        <button onClick={buttonAction} className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${buttonStyle || 'gradient-primary text-white'} `}>
          {buttonText}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-[calc(100vh-180px)] flex flex-col animate-fade-in">
      <div className="mb-4">
        <button onClick={() => { stopCamera(); navigate('/student/dashboard'); }} className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </button>
      </div>

      <div className="flex-1 rounded-3xl overflow-hidden relative shadow-2xl shadow-black/20 flex flex-col gradient-dark">
        <div className="p-5 pb-0 relative z-10 text-white text-center">
          <h2 className="text-base font-bold">
            {stage === 'FACE_VERIFY' ? 'Face Verification' : 'Scan QR Code'}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {stage === 'FACE_VERIFY' ? 'Looking for you...' : 'Point camera at the screen'}
          </p>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          {(stage === 'CAMERA' || stage === 'FACE_VERIFY') && (
            <div className="w-full space-y-4 text-center animate-slide-up">
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/10">
                <video ref={videoRef} playsInline muted className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`} />

                {cameraActive && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-48 h-48 border-2 ${stage === 'FACE_VERIFY' ? 'border-purple-400 rounded-full' : 'border-indigo-400/50 rounded-2xl'} relative transition-all duration-500`}>
                        {stage === 'CAMERA' && (
                          <>
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-indigo-400 rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-indigo-400 rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-indigo-400 rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-indigo-400 rounded-br-lg" />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-0 right-0 text-center px-4">
                      <span className="inline-flex flex-col items-center bg-black/60 backdrop-blur-sm text-[10px] text-white/80 px-3 py-1 rounded-xl">
                        {stage === 'FACE_VERIFY' ? faceStatus : 'Scanning...'}
                        {debugInfo && <span className="text-[8px] text-white/50 mt-1 block">Log: {debugInfo}</span>}
                      </span>
                    </div>
                  </>
                )}

                {!cameraActive && cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <XCircle className="w-10 h-10 text-red-500 mb-3" />
                    <p className="text-sm font-medium text-red-200">{cameraError}</p>
                    <button onClick={startLiveCamera} className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-xs hover:bg-white/20 transition-colors">
                      Retry Permission
                    </button>
                  </div>
                )}

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
                    <p className="text-[10px] text-slate-500">Accessing Camera...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === 'PROCESSING' && (
            <div className="text-center animate-scale-in">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-4" />
              <p className="text-base font-semibold">Checking QR...</p>
            </div>
          )}

          {stage === 'RESULT' && result === 'SUCCESS' && (
            <ResultCard icon={<Sparkles className="w-8 h-8 text-emerald-600" />} title="Attendance Marked!" accent="bg-emerald-100"
              message={`You have been verified for ${markedSubjectName}.`}
              buttonText="Done" buttonAction={() => navigate('/student/dashboard')} />
          )}

          {stage === 'RESULT' && (result === 'FAIL_INVALID_QR' || result === 'FAIL_ERROR') && (
            <ResultCard icon={<XCircle className="w-8 h-8 text-red-600" />} title="Failed" accent="bg-red-100"
              message={resultMessage} buttonText="Retry" buttonAction={() => { setStage('CAMERA'); startLiveCamera(); }} buttonStyle="bg-slate-800 text-white" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
