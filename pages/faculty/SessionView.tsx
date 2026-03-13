import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Smartphone, MapPin, Users, StopCircle, Loader2, Wifi, WifiOff, Clock, UserCheck, UserX, AlertCircle, Search, CheckCircle } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import QRCode from 'qrcode';
import { AuthUser } from '../../services/auth';
import { isApiConfigured, apiGet } from '../../services/api';
import { getActiveSession, rotateToken, endSession as endSessionApi, getAttendanceLogs, createSession, Session, ScanLog } from '../../services/sessions';
import { getStudentsForSection, markManualAttendance, Student } from '../../services/faculty';
import { TODAY_TIMETABLE, SUBJECTS } from '../../data';
import { TimetableEntry } from '../../types';

const SESSION_STORAGE_KEY = 'ams_active_session';
const TIMETABLE_STORAGE_KEY = 'ams_timetable';

interface SessionViewProps {
  authUser: AuthUser | null;
}

const SessionView: React.FC<SessionViewProps> = ({ authUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiReady = isApiConfigured();

  const [sessionId, setSessionId] = useState<string>(id || '');
  const [subjectName, setSubjectName] = useState<string>('');
  const [room, setRoom] = useState<string>('');
  const [section, setSection] = useState<string>('');
  const [semester, setSemester] = useState<number>(6); // Default 6
  const [qrToken, setQrToken] = useState('');
  const [timeLeft, setTimeLeft] = useState(600);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [presentCount, setPresentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lat, setLat] = useState<number>(0);
  const [lng, setLng] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // New State for Manual Attendance & Student List
  const [activeTab, setActiveTab] = useState<'QR' | 'MANUAL'>('QR');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  useEffect(() => { loadSession(); }, [id]);

  const loadSession = async () => {
    if (apiReady) {
      try {
        const result = await getActiveSession({ sessionId: id });
        if (result.length > 0) {
          const session = result[0];
          setSessionId(session.sessionId); setSubjectName(session.subjectName);
          setRoom(session.room); setSection(session.section); setQrToken(session.token);
          setLat(Number(session.lat) || 0); setLng(Number(session.lng) || 0);
          // Try to infer semester if available, else default
          setSemester(6);
          loadStudentsForSection(6, session.section);
        } else {
          const ttResult = await apiGet('getTimetable', { facultyId: authUser?.id || '' });
          const entry = ttResult.success ? ttResult.timetable.find((t: any) => t.id === id) : null;
          if (entry) {
            let roomLat = 12.9716, roomLng = 77.5946;
            try {
              const roomsResult = await apiGet('getRooms');
              if (roomsResult.success) {
                const roomInfo = roomsResult.rooms.find((r: any) => r.name === entry.room);
                if (roomInfo) { roomLat = roomInfo.lat; roomLng = roomInfo.lng; }
              }
            } catch { }
            const newSession = await createSession({
              facultyId: authUser?.id || '', subjectCode: entry.subjectCode,
              subjectName: entry.subjectName || entry.subjectCode, room: entry.room,
              section: entry.section, endTime: entry.endTime, lat: roomLat, lng: roomLng,
              semester: entry.semester || 6 // Pass semester
            });
            setSessionId(newSession.sessionId); setQrToken(newSession.token);
            setSubjectName(entry.subjectName || entry.subjectCode);
            setRoom(entry.room); setSection(entry.section);
            setLat(roomLat); setLng(roomLng);
            setSemester(entry.semester || 6);
            loadStudentsForSection(entry.semester || 6, entry.section);
          }
        }
      } catch (err) { console.error('Failed to load session:', err); fallbackToLocal(); }
    } else { fallbackToLocal(); }
    setLoading(false);
  };

  const loadStudentsForSection = async (sem: number, sec: string) => {
    try {
      const students = await getStudentsForSection(sem, sec);
      setAllStudents(students);
    } catch (e) {
      console.error("Failed to load students", e);
    }
  };

  const fallbackToLocal = () => {
    const storedTimetable = localStorage.getItem(TIMETABLE_STORAGE_KEY);
    let foundEntry: TimetableEntry | undefined;
    if (storedTimetable) {
      foundEntry = JSON.parse(storedTimetable).find((t: TimetableEntry) => t.id === id);
    } else { foundEntry = TODAY_TIMETABLE.find(t => t.id === id); }
    if (foundEntry) {
      setSubjectName(SUBJECTS.find(s => s.id === foundEntry!.subjectId)?.name || 'Unknown');
      setRoom(foundEntry.room); setSection(foundEntry.section);
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      const storedData = stored ? JSON.parse(stored) : null;
      if (storedData && storedData.sessionId === id) {
        setQrToken(storedData.token); setLogs(storedData.logs || []);
        setPresentCount((storedData.logs || []).filter((l: any) => l.status === 'SUCCESS').length);
      } else {
        const token = `TOKEN_${Math.random().toString(36).substr(2, 9)}`;
        setQrToken(token);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ sessionId: id, token, logs: [] }));
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => { setTimeLeft(prev => (prev > 0 ? prev - 1 : 0)); }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ref to track timeLeft without triggering re-renders in the rotation effect
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    // Rotation Interval Logic
    if (!sessionId) return;

    const qrInterval = setInterval(async () => {
      // Check current time from ref to allow interval to persist
      if (timeLeftRef.current <= 0) return;

      if (apiReady) {
        try {
          const newToken = await rotateToken(sessionId);
          console.log('Token rotated successfully:', newToken);
          setQrToken(newToken);
        } catch (err) {
          console.error('Failed to rotate token. Backend might be unreachable or session invalid.', err);
        }
      } else {
        const newToken = `TOKEN_${Math.random().toString(36).substr(2, 9)}`;
        setQrToken(newToken);
        const currentData = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || '{}');
        if (currentData.sessionId === id) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...currentData, token: newToken }));
      }
    }, 10000); // 10 seconds

    return () => clearInterval(qrInterval);
    // CRITICAL FIX: Removed 'timeLeft' and 'qrToken' from dependencies.
    // 'timeLeft' caused reset every 1s. 'qrToken' caused reset on every update.
    // Now the interval runs stable every 10s.
  }, [sessionId, apiReady, id]);

  useEffect(() => {
    if (!sessionId) return;
    const poll = setInterval(async () => {
      if (apiReady) {
        try {
          const newLogs = await getAttendanceLogs(sessionId);
          setLogs(newLogs.map(l => ({ ...l, status: 'PRESENT' }))); setPresentCount(newLogs.length);
        } catch { }
      } else {
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        const data = stored ? JSON.parse(stored) : null;
        if (data?.sessionId === id && data.logs) {
          setLogs(data.logs); setPresentCount(data.logs.filter((l: any) => l.status === 'SUCCESS').length);
        }
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [sessionId]);

  useEffect(() => {
    if (canvasRef.current && qrToken) {
      QRCode.toCanvas(canvasRef.current, qrToken, {
        width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' }
      }, (error) => { if (error) console.error(error); });
    }
  }, [qrToken]);

  const handleEndClass = async () => {
    if (apiReady && sessionId) {
      try { await endSessionApi(sessionId); } catch (err) { console.error('Failed to end:', err); }
    } else {
      const storedTimetableStr = localStorage.getItem(TIMETABLE_STORAGE_KEY);
      if (storedTimetableStr) {
        const timetable = JSON.parse(storedTimetableStr);
        localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(timetable.map((t: any) => t.id === id ? { ...t, status: 'COMPLETED' } : t)));
      }
    }
    navigate('/faculty/dashboard');
  };

  const handleManualMark = async (student: Student, status: 'PRESENT' | 'ABSENT', reason?: string) => {
    setManualLoading(true);
    if (apiReady) {
      try {
        const res = await markManualAttendance({
          sessionId,
          usn: student.usn,
          studentName: student.name,
          status,
          reason,
          facultyId: authUser?.id || ''
        });
        if (res.success) {
          // Optimistic update
          if (status === 'PRESENT') {
            // Check if already in logs to avoid duplicate
            if (!logs.find(l => l.usn === student.usn)) {
              setLogs(prev => [...prev, { studentName: student.name, usn: student.usn, timestamp: new Date().toISOString(), status: 'PRESENT' }]);
              setPresentCount(prev => prev + 1);
            }
          }
          alert(`Marked ${student.name} as ${status}`);
        } else {
          alert('Failed: ' + res.error);
        }
      } catch (e) {
        console.error(e);
        alert('Error marking attendance');
      }
    } else {
      alert('Manual marking requires backend connection.');
    }
    setManualLoading(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const timerPercent = (timeLeft / 600) * 100;

  // Calculate stats
  const totalStudents = allStudents.length || 60; // Default fallback
  const absentCount = totalStudents - presentCount;

  // Filter students for manual tab
  const filteredStudents = allStudents.filter(s =>
    s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    s.usn.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <button onClick={() => navigate('/faculty/dashboard')} className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard
        </button>
        <div className="flex items-center space-x-2">
          {apiReady ? (
            <span className="flex items-center text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
              <Wifi className="w-3 h-3 mr-1" /> Live
            </span>
          ) : (
            <span className="flex items-center text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
              <WifiOff className="w-3 h-3 mr-1" /> Offline
            </span>
          )}
          <button onClick={handleEndClass} className="flex items-center bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30">
            <StopCircle className="w-4 h-4 mr-1.5" /> End Class
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: QR or Manual */}
        <div className="lg:col-span-2 glass-card overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('QR')}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'QR' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/10' : 'text-slate-400 hover:text-slate-600'}`}>
              <Smartphone className="w-4 h-4 mr-2" /> QR Session
            </button>
            <button
              onClick={() => setActiveTab('MANUAL')}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center transition-colors ${activeTab === 'MANUAL' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/10' : 'text-slate-400 hover:text-slate-600'}`}>
              <UserCheck className="w-4 h-4 mr-2" /> Manual Attendance
            </button>
          </div>

          {activeTab === 'QR' ? (
            <>
              {/* Header Strip */}
              <div className="p-5 gradient-dark text-white flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">{subjectName}</h2>
                  <p className="text-slate-400 text-xs mt-0.5 flex items-center">
                    <MapPin className="w-3 h-3 mr-1" /> {room} • Sec {section} • Sem {semester}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-mono font-bold ${timeLeft <= 60 ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(timeLeft)}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {timeLeft <= 0 ? 'EXPIRED' : 'Remaining'}
                  </p>
                </div>
              </div>

              {/* Timer Bar */}
              <div className="h-1 bg-slate-100">
                <div className={`h-full transition-all duration-1000 ${timeLeft <= 60 ? 'bg-red-500' : 'gradient-accent'}`}
                  style={{ width: `${timerPercent}%` }} />
              </div>

              {/* QR Area */}
              <div className="p-8 flex flex-col items-center justify-center min-h-[380px]">
                {timeLeft <= 0 ? (
                  <div className="text-center animate-scale-in">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1.5">Session Timer Expired</h3>
                    <p className="text-sm text-slate-500 mb-4">Students can no longer scan.</p>
                    <button onClick={handleEndClass} className="gradient-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm">
                      End Class
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-5 rounded-2xl shadow-lg shadow-black/5 border border-slate-100 mb-5">
                      <canvas ref={canvasRef} />
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mb-2">
                      <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
                      <span className="font-medium">Token rotates every 10s</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate max-w-[200px] font-mono">{qrToken}</p>
                    <div className="mt-4 flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-4 py-2 rounded-xl">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Geo-Fence: <span className="font-semibold text-slate-700">{room}</span>
                        {lat > 0 && <span className="text-[10px] text-slate-400 ml-1">({lat.toFixed(4)}, {lng.toFixed(4)})</span>}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 h-[500px] flex flex-col">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student by name or USN..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {manualLoading && (
                  <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></div>
                )}
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No students found</div>
                ) : (
                  filteredStudents.map(student => {
                    const isPresent = logs.some(l => l.usn === student.usn);
                    return (
                      <div key={student.usn} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{student.usn}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {isPresent ? (
                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg flex items-center">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Present
                            </span>
                          ) : (
                            <button
                              onClick={() => handleManualMark(student, 'PRESENT')}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-lg transition-colors">
                              Mark Present
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Stats */}
        <div className="space-y-4">
          {/* Detailed Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4 text-center">
              <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Present</h3>
              <p className="text-2xl font-black text-emerald-500">{presentCount}</p>
            </div>
            <div className="glass-card p-4 text-center">
              <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Absent</h3>
              <p className="text-2xl font-black text-red-400">{absentCount}</p>
            </div>
          </div>
          <div className="glass-card p-3 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Strength</span>
            <span className="text-sm font-black text-slate-900">{totalStudents}</span>
          </div>

          {/* Activity Log */}
          <div className="candy-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-800">Live Activity</h3>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {logs.length === 0 && (
                <div className="p-8 text-center">
                  <Smartphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 font-medium">Waiting for scans...</p>
                </div>
              )}
              {logs.slice().reverse().map((log, idx) => (
                <div key={log.usn + idx} className="p-3.5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{log.studentName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{log.usn}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                      <Smartphone className="w-2.5 h-2.5 mr-1" /> {log.status || 'Verified'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default SessionView;