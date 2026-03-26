import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, Clock, MapPin, Plus, CheckCircle, Loader2, Wifi, WifiOff, BookOpen, Users, Zap, XCircle, ArrowRightLeft, AlertTriangle, AlertCircle } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import { AuthUser } from '../../services/auth';
import { isApiConfigured } from '../../services/api';
import { apiGet, apiPost } from '../../services/api';
import { createSession } from '../../services/sessions';
import { cancelClass, swapClass, getSwappableClasses, getNotifications, SwappableClass } from '../../services/faculty';
import NotificationCenter from '../../components/NotificationCenter';
import { TODAY_TIMETABLE, SUBJECTS } from '../../data';
import { TimetableEntry } from '../../types';

interface FacultyDashboardProps {
  authUser: AuthUser | null;
}

interface TimetableItem {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string;
  section: string;
  semester?: number; // Added semester support
  room: string;
  status: string;
  sessionId: string | null;
}

const TIMETABLE_STORAGE_KEY = 'ams_timetable';

const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ authUser }) => {
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null); // For cancel/swap loading
  const apiReady = isApiConfigured();
  const [displayDay, setDisplayDay] = useState<string>('');

  // Swap & Notifications State
  const [showNotifications, setShowNotifications] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapSource, setSwapSource] = useState<TimetableItem | null>(null);
  const [swappableClasses, setSwappableClasses] = useState<SwappableClass[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [latestNotification, setLatestNotification] = useState<any>(null);

  // Cache loading
  useEffect(() => {
    const cached = localStorage.getItem(TIMETABLE_STORAGE_KEY);
    if (cached) {
      setTimetable(JSON.parse(cached));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetable();
    loadNotifications();
    const interval = setInterval(() => {
      loadTimetable();
      loadNotifications();
    }, 30000); // Increased interval for performance
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications
  const loadNotifications = async () => {
    if (authUser && apiReady) {
      try {
        const notes = await getNotifications(authUser.id);
        const unread = notes.filter(n => !n.read);
        if (unread.length > 0) {
          setLatestNotification(unread[0]);
        } else {
          setLatestNotification(null);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const loadTimetable = async () => {
    if (apiReady) {
      try {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        const result = await apiGet('getTimetable', { facultyId: authUser?.id || '', day: today });
        if (result.success) {
          setTimetable(result.timetable);
          setDisplayDay(result.displayDay || today);
          localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(result.timetable));
        }
      } catch (err) {
        console.error('Failed to load timetable:', err);
        // Don't fallback if we already have cache
        if (timetable.length === 0) fallbackToLocal();
      }
    } else {
      fallbackToLocal();
    }
    setLoading(false);
  };

  const fallbackToLocal = () => {
    // Logic handled in initial useEffect or persistent cache
    if (timetable.length > 0) return;

    const storedData = localStorage.getItem(TIMETABLE_STORAGE_KEY);
    if (storedData) {
      setTimetable(JSON.parse(storedData));
    } else {
      setTimetable(TODAY_TIMETABLE.map(e => ({
        id: e.id, day: e.dayOfWeek, startTime: e.startTime, endTime: e.endTime,
        subjectCode: e.subjectId, subjectName: SUBJECTS.find(s => s.id === e.subjectId)?.name || '',
        facultyId: e.facultyId, section: e.section, room: e.room, status: e.status, sessionId: null,
        semester: 6 // Mock data
      })));
    }
  };

  const handleStartSession = async (item: TimetableItem) => {
    if (item.sessionId) { navigate(`/faculty/session/${item.sessionId}`); return; }

    // Check for expiry
    if (isClassExpired(item)) {
      alert('This class time has passed. You cannot start a session.');
      return;
    }

    if (apiReady) {
      setStarting(item.id);
      try {
        let lat = 12.9716, lng = 77.5946;
        try {
          const roomsResult = await apiGet('getRooms');
          if (roomsResult.success) {
            const room = roomsResult.rooms.find((r: any) => r.name === item.room);
            if (room) { lat = room.lat; lng = room.lng; }
          }
        } catch { }
        const result = await createSession({
          facultyId: authUser?.id || '', subjectCode: item.subjectCode, subjectName: item.subjectName,
          room: item.room, section: item.section, endTime: item.endTime, lat, lng,
          semester: item.semester // Pass semester if available
        });
        navigate(`/faculty/session/${result.sessionId}`);
      } catch (err) {
        console.error('Failed to create session:', err);
        alert('Failed to start session. Please try again.');
      } finally { setStarting(null); }
    } else {
      navigate(`/faculty/session/${item.id}`);
    }
  };

  const handleCancelClass = async (item: TimetableItem) => {
    if (!window.confirm(`Are you sure you want to cancel ${item.subjectName}? Students will be notified.`)) return;

    setProcessingId(item.id);
    if (apiReady) {
      try {
        const res = await cancelClass({ facultyId: authUser?.id || '', ttId: item.id });
        if (res.success) {
          loadTimetable(); // Refresh

          // WhatsApp Share
          const message = `🚨 *Class Cancelled*\n\nThe class *${item.subjectName}* scheduled for *${item.startTime}* has been cancelled.`;
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

          // Trigger a UI element for manual sharing to avoid popup blockers
          if (window.confirm('Class cancelled successfully! Click OK to open WhatsApp to share this update.')) {
            const win = window.open(whatsappUrl, '_blank');
            if (!win) alert('Popup blocked. Please allow popups to share to WhatsApp.');
          }

        } else {
          alert('Failed to cancel class: ' + res.message);
        }
      } catch (e) {
        console.error(e);
        alert('Error cancelling class');
      }
    } else {
      alert('Cancel feature requires backend connection.');
    }
    setProcessingId(null);
  };

  const openSwapModal = async (item: TimetableItem) => {
    setSwapSource(item);
    setSwapModalOpen(true);
    setSwapLoading(true);
    setSwappableClasses([]);

    if (apiReady) {
      try {
        const classes = await getSwappableClasses(item.id);
        setSwappableClasses(classes);
      } catch (e) {
        console.error(e);
        alert('Failed to fetch swappable classes');
      }
    }
    setSwapLoading(false);
  };

  const handleExecuteSwap = async (targetId: string) => {
    if (!swapSource) return;

    setProcessingId(swapSource.id); // Show loading on the card underlying
    setSwapModalOpen(false); // Close modal

    if (apiReady) {
      try {
        const res = await swapClass({
          sourceTTId: swapSource.id,
          targetTTId: targetId,
          initiatorId: authUser?.id || ''
        });

        if (res.success) {
          alert('Class swapped successfully! Notifications sent.');
          loadTimetable();
        } else {
          alert('Failed to swap: ' + res.message);
        }
      } catch (e) {
        console.error(e);
        alert('Error performing swap');
      }
    }
    setProcessingId(null);
    setSwapSource(null);
  };

  // Helper to add 1 hour to time string
  const incrementTime = (time: string, hours: number) => {
    const [h, m] = time.split(':').map(Number);
    return `${h + hours}:${m < 10 ? '0' + m : m}`;
  }

  // Helper to check if class is expired (now + 10 mins grace period after end time)
  const isClassExpired = (item: TimetableItem) => {
    if (item.status === 'COMPLETED') return false; // Already done (hidden or shown as completed)
    if (item.status === 'ONGOING') return false; // Active now

    const now = new Date();
    // Only check if it's today's class
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (item.day !== days[now.getDay()]) return false; // Not today (or maybe yesterday's if we strictly check date? but standard timetable is day-based)

    const [endH, endM] = item.endTime.split(':').map(Number);
    const endTimeDate = new Date();
    endTimeDate.setHours(endH, endM, 0, 0);

    // Extend window by 10 minutes
    endTimeDate.setMinutes(endTimeDate.getMinutes() + 10);

    return now > endTimeDate;
  };

  // Helper to check if class can be started (now >= start time - 10 mins)
  const isClassStartable = (item: TimetableItem) => {
    if (item.status === 'ONGOING') return true;

    const now = new Date();
    const [startH, startM] = item.startTime.split(':').map(Number);
    const startTimeDate = new Date();
    startTimeDate.setHours(startH, startM, 0, 0);

    // Allow start 10 mins before
    startTimeDate.setMinutes(startTimeDate.getMinutes() - 10);

    return now >= startTimeDate;
  };

  const displayName = authUser?.name || 'Professor';
  const completed = timetable.filter(t => t.status === 'COMPLETED').length;
  const ongoing = timetable.filter(t => t.status === 'ONGOING').length;

  // Stats calculation
  const totalClasses = timetable.length;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Notification Banner - Prominent Placeholder */}
      {/* Notification Banner - Prominent Placeholder */}
      {latestNotification && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{latestNotification.title}</h3>
              <p className="text-indigo-100 text-sm">{latestNotification.message}</p>
              <p className="text-white/60 text-[10px] mt-1">{new Date(latestNotification.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={() => setShowNotifications(true)}
            className="bg-white text-indigo-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors whitespace-nowrap"
          >
            View All
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {displayName} 👋
          </h2>
          <p className="text-slate-500 text-sm mt-0.5 flex items-center">
            Here is your schedule for today
            {apiReady ? (
              <span className="ml-2 inline-flex items-center text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                <Wifi className="w-3 h-3 mr-1" /> Live
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                <WifiOff className="w-3 h-3 mr-1" /> Offline
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/faculty/add-class')}
            className="gradient-primary text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 flex items-center justify-center transition-all duration-300 transform hover:-translate-y-0.5 text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Extra Class
          </button>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-xl bg-white text-slate-600 shadow-sm hover:shadow-md transition-all border border-slate-200"
          >
            <div className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <AlertCircle className="w-5 h-5" />
          </button>
        </div>
      </div >

      {
        showNotifications && authUser && (
          <NotificationCenter userId={authUser.id} onClose={() => setShowNotifications(false)} />
        )
      }

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 stagger-children">
        {[
          { label: 'Total', value: totalClasses, icon: BookOpen, gradient: 'from-indigo-500 to-blue-500', shadow: 'shadow-indigo-500/15' },
          { label: 'Completed', value: completed, icon: CheckCircle, gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-500/15' },
          { label: 'Ongoing', value: ongoing, icon: Zap, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/15' },
        ].map((stat) => (
          <div key={stat.label} className={`candy-card p-4 flex items-center space-x-3 transition-all hover:scale-[1.05]`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-md ${stat.shadow} flex-shrink-0`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{stat.value}</p>
              <p className="text-[9px] sm:text-[11px] text-slate-400 font-black uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Section Header */}
      <div className="flex items-center space-x-2">
        <div className="w-1 h-5 rounded-full gradient-accent" />
        <h3 className="text-base font-bold text-slate-800">
          {displayDay && displayDay !== new Date().toLocaleDateString('en-US', { weekday: 'long' }) ? `Upcoming: ${displayDay}'s Timetable` : "Today's Timetable"}
        </h3>
      </div>

      {/* Class Cards */}
      {
        timetable.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-400">No classes scheduled</p>
            <p className="text-sm text-slate-400 mt-1">Click "Add Extra Class" to add one</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
            {timetable.filter(session => !isClassExpired(session)).map((session) => {
              const expired = isClassExpired(session); // Should be false if filtered, but kept for logic
              const startable = isClassStartable(session);
              const isCompleted = session.status === 'COMPLETED';
              const isOngoing = session.status === 'ONGOING';

              // Calculate time until start for UI feedback
              const now = new Date();
              const [startH, startM] = session.startTime.split(':').map(Number);
              const startDate = new Date();
              startDate.setHours(startH, startM, 0, 0);
              const minutesToStart = Math.ceil((startDate.getTime() - now.getTime()) / 60000);

              return (
                <div key={session.id} className={`glass-card p-5 relative overflow-hidden transition-all duration-300 ${isOngoing ? 'ring-2 ring-indigo-400/30 border-indigo-200' :
                  expired ? 'opacity-80 grayscale-[0.5]' : ''
                  }`}>
                  {/* Status Accent */}
                  <div className={`absolute top-0 left-0 w-1 h-full rounded-r-full ${isOngoing ? 'bg-indigo-500' :
                    isCompleted ? 'bg-slate-300' :
                      expired ? 'bg-slate-800' : 'bg-emerald-400'
                    }`} />

                  <div className="flex justify-between items-start mb-3 ml-3">
                    <div>
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-2 ${isOngoing ? 'bg-indigo-100 text-indigo-700' :
                        isCompleted ? 'bg-slate-100 text-slate-500' :
                          expired ? 'bg-slate-800 text-white' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                        {isOngoing && '● '}{isOngoing ? 'Live Now' : expired ? 'Expired' : session.status}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">{session.subjectName || session.subjectCode}</h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <p className="text-xs text-slate-500">Sec {session.section}</p>
                        {session.semester && <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">Sem {session.semester}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">{session.startTime}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-medium">Start</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mb-4 ml-3 text-xs text-slate-500">
                    <div className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {session.endTime}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {session.room}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {!isCompleted && !expired && !isOngoing && (
                      <div className="flex space-x-2 mb-2">
                        <button
                          onClick={() => handleCancelClass(session)}
                          disabled={!!processingId}
                          className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 flex items-center justify-center transition-colors">
                          <XCircle className="w-3 h-3 mr-1" />
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            console.log('Navigating to swap with session:', session);
                            navigate('/faculty/swap-class', { state: { sourceClass: session } });
                          }}
                          disabled={processingId === session.id}
                          className="flex-1 py-1.5 rounded-lg border border-indigo-200 text-indigo-500 text-xs font-semibold hover:bg-indigo-50 flex items-center justify-center transition-colors">
                          <ArrowRightLeft className="w-3 h-3 mr-1" />
                          Swap
                        </button>
                      </div>
                    )}

                    {!isCompleted ? (
                      <button
                        onClick={() => handleStartSession(session)}
                        disabled={starting === session.id || expired}
                        className={`w-full flex items-center justify-center py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:-translate-y-0.5 ${expired
                          ? 'bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                          : isOngoing
                            ? 'gradient-success text-white shadow-md shadow-emerald-500/20'
                            : 'gradient-primary text-white shadow-md shadow-blue-500/20'
                          } disabled:opacity-70 disabled:transform-none`}
                      >
                        {starting === session.id ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Starting...</>
                        ) : (
                          <>
                            {isOngoing ? <PlayCircle className="w-4 h-4 mr-2" /> : expired ? <Clock className="w-4 h-4 mr-2" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                            {isOngoing ? 'Resume Session' : expired ? 'Class Ended' : 'Generate QR & Start'}
                          </>
                        )}
                      </button>
                    ) : (
                      <button className="w-full flex items-center justify-center py-2.5 rounded-xl font-medium text-sm bg-slate-100 text-slate-400 cursor-not-allowed">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Completed
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div >
  );
};

export default FacultyDashboard;