import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, QrCode, Loader2, Wifi, WifiOff, TrendingUp, Clock, MapPin, AlertCircle } from 'lucide-react';
import { AuthUser } from '../../services/auth';
import { isApiConfigured, apiGet } from '../../services/api';
import { getStudentStats, SubjectStat } from '../../services/attendance';
import { getNotifications } from '../../services/faculty';
import { formatTime } from '../../utils';
import { STUDENT_SUBJECT_STATS, TODAY_TIMETABLE, SUBJECTS } from '../../data';
import { TimetableEntry } from '../../types';

interface StudentDashboardProps {
  authUser: AuthUser | null;
}

interface TimetableItem {
  id: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  room: string;
  status: string;
}

const TIMETABLE_STORAGE_KEY = 'ams_timetable_v2';
const STATS_STORAGE_KEY = 'ams_stats_v2';
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// SVG Progress Ring
const ProgressRing: React.FC<{ percentage: number; size?: number; strokeWidth?: number; color: string }> = ({
  percentage, size = 180, strokeWidth = 14, color
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 filter drop-shadow-sm">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="progress-ring-circle"
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center group-hover:scale-110 transition-transform duration-500">
        <span className="text-4xl font-black text-slate-900 leading-none">{percentage}%</span>
        <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Status</span>
      </div>
    </div>
  );
};

const StudentDashboard: React.FC<StudentDashboardProps> = ({ authUser }) => {
  const navigate = useNavigate();
  const apiReady = isApiConfigured();
  const [loading, setLoading] = useState(false);
  const [overallPercentage, setOverallPercentage] = useState(0);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [hasActiveClass, setHasActiveClass] = useState(false);
  const [activeClassName, setActiveClassName] = useState('');
  const [activeClassTime, setActiveClassTime] = useState('');
  const [activeClassRoom, setActiveClassRoom] = useState('');
  const [selectedDay, setSelectedDay] = useState(DAYS_OF_WEEK[new Date().getDay() - 1] || 'Monday');
  const [timetableCache, setTimetableCache] = useState<Record<string, TimetableItem[]>>({});
  const [latestNotification, setLatestNotification] = useState<any>(null);

  useEffect(() => {
    // Immediate local load for instant UI feedback
    fallbackToLocal(selectedDay, true);

    // Initial load for everything in background
    const initialLoad = async () => {
      await Promise.all([
        loadStats(),
        loadTimetable(selectedDay),
        loadNotifications()
      ]);
    };
    initialLoad();

    // Stats periodic refresh (long interval)
    const statsInterval = setInterval(() => {
      loadStats();
      loadNotifications();
    }, 60000);
    return () => clearInterval(statsInterval);
  }, []);

  useEffect(() => {
    // Timetable-only refresh when day changes
    const dayChangeLoad = async () => {
      // Immediate local load for fast UI feedback if not in cache
      if (!timetableCache[selectedDay]) {
        fallbackToLocal(selectedDay, false); // false = don't reset stats
      }
      await loadTimetable(selectedDay);
    };

    dayChangeLoad();

    // Timetable periodic refresh for current day
    const ttInterval = setInterval(() => loadTimetable(selectedDay), 30000);
    return () => clearInterval(ttInterval);
  }, [selectedDay]);

  const loadStats = async () => {
    if (apiReady) {
      try {
        const stats = await getStudentStats(authUser?.usn || authUser?.id || '');
        setSubjectStats(stats.stats);
        setOverallPercentage(stats.overall || 0);
        // Persist real data
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
      } catch (err) {
        console.error('Failed to load stats:', err);
        fallbackToLocal(undefined, true);
      }
    } else {
      fallbackToLocal(undefined, true);
    }
  };

  const loadTimetable = async (day: string) => {
    // Fast path: cache check - Simplified to always try fetch for correct filtering updates
    if (timetableCache[day]) {
      setTimetable(timetableCache[day]);
    }

    if (apiReady && authUser) {
      try {
        const result = await apiGet('getTimetable', {
          day,
          section: authUser.section,
          semester: authUser.semester
        });

        if (result.success) {
          const items: TimetableItem[] = result.timetable.map((t: any) => ({
            id: t.id, subjectName: t.subjectName || t.subjectCode,
            startTime: formatTime(t.startTime), endTime: formatTime(t.endTime), room: t.room, status: t.status,
          }));

          setTimetable(items);
          setTimetableCache(prev => ({ ...prev, [day]: items }));
          // Persist current day timetable
          localStorage.setItem(`${TIMETABLE_STORAGE_KEY}_${day}`, JSON.stringify(items));

          const active = items.find(t => t.status === 'ONGOING');
          if (active) {
            setHasActiveClass(true);
            setActiveClassName(active.subjectName);
            setActiveClassTime(`${active.startTime} - ${active.endTime}`); // Already formatted
            setActiveClassRoom(active.room);
          } else if (day === DAYS_OF_WEEK[new Date().getDay() - 1]) {
            setHasActiveClass(false);
          }
        }
      } catch (err) {
        console.error('Failed to load timetable:', err);
        if (!timetableCache[day]) fallbackToLocal(day, false);
      }
    } else {
      if (!timetableCache[day]) fallbackToLocal(day, false);
    }
  };

  const fallbackToLocal = (day?: string, updateStats: boolean = true) => {
    if (updateStats) {
      const storedStats = localStorage.getItem(STATS_STORAGE_KEY);
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        setSubjectStats(parsed.stats);
        setOverallPercentage(parsed.overall);
      } else {
        // Only if absolutely NO history, show 0 instead of random 88%
        setSubjectStats([]);
        setOverallPercentage(0);
      }
    }

    const targetDay = day || selectedDay;
    const storedTT = localStorage.getItem(`${TIMETABLE_STORAGE_KEY}_${targetDay}`);

    if (storedTT) {
      const items = JSON.parse(storedTT);
      setTimetable(items);
      setTimetableCache(prev => ({ ...prev, [targetDay]: items }));
    } else {
      // Use original today's timetable as a LAST resort for fallback
      const allEntries: TimetableEntry[] = TODAY_TIMETABLE;
      const entries = allEntries.filter(e => e.dayOfWeek === targetDay);
      const items = entries.map(e => ({
        id: e.id, subjectName: SUBJECTS.find(s => s.id === e.subjectId)?.name || e.subjectId,
        startTime: formatTime(e.startTime), endTime: formatTime(e.endTime), room: e.room, status: e.status,
      }));
      setTimetable(items);
      setTimetableCache(prev => ({ ...prev, [targetDay]: items }));
    }

    // Active class check for current day
    if (targetDay === DAYS_OF_WEEK[new Date().getDay() - 1]) {
      const storedTT = localStorage.getItem(`${TIMETABLE_STORAGE_KEY}_${targetDay}`);
      const items = storedTT ? JSON.parse(storedTT) : [];
      const active = items.find((t: any) => t.status === 'ONGOING');
      if (active) {
        setHasActiveClass(true);
        setActiveClassName(active.subjectName);
        setActiveClassTime(`${active.startTime} - ${active.endTime}`); // Already formatted in cache/fallback
        setActiveClassRoom(active.room);
      } else {
        setHasActiveClass(false);
      }
    }
  };

  const loadNotifications = async () => {
    if (authUser && apiReady) {
      try {
        const notes = await getNotifications(authUser.id);
        const unread = notes.filter((n: any) => !n.read);
        if (unread.length > 0) setLatestNotification(unread[0]);
        else setLatestNotification(null);
      } catch (e) {
        console.error('Error fetching notifications:', e);
      }
    }
  };

  const isGood = overallPercentage >= 85;
  const ringColor = isGood ? 'var(--primary)' : 'var(--warning)';

  return (
    <div className="space-y-4 sm:space-y-8 animate-fade-in">
      {/* Notification Banner */}
      {latestNotification && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/20 flex items-center justify-between animate-fade-in mb-4">
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
        </div>
      )}

      {/* Top Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Face ID Setup Card - High Visibility */}
        <div
          onClick={() => navigate('/student/face-register')}
          className="col-span-1 lg:col-span-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-6 text-white flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform shadow-xl shadow-purple-900/20"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <div className="w-6 h-6 rounded-full border-2 border-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">One-Time Setup</h3>
              <p className="text-purple-100 text-sm">Register your Face ID to verify attendance.</p>
            </div>
          </div>
          <button className="bg-white text-purple-600 px-6 py-2 rounded-full font-bold text-sm">
            Setup Now
          </button>
        </div>

        {/* Progress Ring Card */}
        <div className="candy-card p-6 sm:p-10 flex flex-col items-center justify-center">
          <h3 className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-8">Performance</h3>
          <ProgressRing percentage={overallPercentage} color={ringColor} />
          <div className={`mt-10 flex items-center px-6 py-2 rounded-full font-black text-xs uppercase tracking-wider ${isGood ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
            <TrendingUp className="w-4 h-4 mr-2" />
            {isGood ? 'Excellent Track' : 'Needs Attention'}
          </div>

          <div className={`mt-10 flex items-center px-6 py-2 rounded-full font-black text-xs uppercase tracking-wider ${isGood ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
            <TrendingUp className="w-4 h-4 mr-2" />
            {isGood ? 'Excellent Track' : 'Needs Attention'}
          </div>
        </div>

        {/* Active Class Card */}
        <div className={`lg:col-span-2 rounded-[40px] p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden transition-all duration-700 ${hasActiveClass
          ? 'bg-slate-900 text-white shadow-2xl shadow-indigo-900/40'
          : 'candy-card'
          }`}>
          {hasActiveClass && (
            <>
              {/* Decorative candy glow */}
              <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-20 blur-[80px]" style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }} />
              <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full opacity-10 blur-[60px]" style={{ background: 'radial-gradient(circle, var(--success) 0%, transparent 70%)' }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Happening Now</span>
                    <h2 className="text-2xl sm:text-5xl font-black mt-2 mb-4 tracking-tight">{activeClassName}</h2>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <p className="bg-slate-800 px-4 py-2 rounded-2xl text-slate-100 text-sm font-bold flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-indigo-400" /> {activeClassTime}
                      </p>
                      <p className="bg-slate-800 px-4 py-2 rounded-2xl text-slate-100 text-sm font-bold flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-indigo-400" /> {activeClassRoom}
                      </p>
                    </div>
                  </div>
                  <div className="bg-emerald-500 text-white text-[10px] px-4 py-2 rounded-full font-black uppercase tracking-widest animate-pulse-glow flex-shrink-0 shadow-lg shadow-emerald-500/30">
                    Live Session
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate('/student/scan')}
                className="mt-10 relative z-10 w-full sm:w-auto self-start bg-white text-indigo-600 px-10 py-5 rounded-full font-black text-base flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-500 shadow-2xl shadow-white/10 tap-squish"
              >
                <QrCode className="w-6 h-6 mr-3" />
                Scan QR Attendance
              </button>
            </>
          )}
          {!hasActiveClass && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 rounded-[28px] bg-slate-50 flex items-center justify-center mb-6 shadow-inner">
                <CheckCircle className="w-10 h-10 text-slate-200" />
              </div>
              <h2 className="text-2xl font-black text-slate-300">No Active Sessions</h2>
              <p className="text-sm text-slate-400 mt-2 font-bold max-w-xs">You're all caught up! Next session will appear here when it starts.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Stats */}
        <div className="candy-card overflow-hidden">
          <div className="p-5 sm:p-8 border-slate-50 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-6 rounded-full bg-indigo-500" />
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Subject-wise Status</h3>
            </div>
            <span className="text-[10px] text-indigo-600 font-black bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider">Target: 85%</span>
          </div>
          <div className="px-4 pb-4 space-y-2 stagger-children">
            {subjectStats.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <p className="text-sm font-bold">Waiting for data sync...</p>
              </div>
            ) : (
              subjectStats.map((sub) => (
                <div key={sub.subjectCode} className="p-4 sm:p-5 bg-slate-50/40 hover:bg-slate-50 rounded-[28px] border border-transparent hover:border-indigo-100 transition-all duration-500 flex items-center group shadow-sm hover:shadow-xl hover:shadow-indigo-500/5">
                  <div className="flex-1">
                    <h4 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{sub.subjectCode}</h4>
                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide opacity-60">{sub.subjectName}</p>
                    {/* Progress bar */}
                    <div className="mt-4 w-full h-3 bg-slate-100 rounded-full overflow-hidden candy-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${sub.percentage >= 85 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                        style={{ width: `${sub.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right ml-6 flex items-center space-x-4">
                    <div>
                      <span className={`block text-2xl font-black ${sub.percentage < 85 ? 'text-amber-500' : 'text-slate-900'}`}>
                        {sub.percentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{sub.attendedClasses}/{sub.totalClasses} Classes</span>
                    </div>
                    {sub.percentage < 85 && (
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0 animate-pulse-glow">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="candy-card p-6 sm:p-8 flex flex-col max-h-[600px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-6 rounded-full bg-indigo-400" />
              <h3 className="text-sm font-black text-slate-900 tracking-tight">Weekly Timetable</h3>
            </div>

            {/* Day Selection Chips */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 sm:pb-0 custom-scrollbar scrollbar-hide">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex-shrink-0 tap-squish ${selectedDay === day
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                    : 'bg-slate-50 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-md'
                    }`}
                >
                  {day.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <div className="relative ml-4 space-y-10 overflow-y-auto pr-6 custom-scrollbar flex-1 stagger-children">
            {/* Vertical line - Candy thread style - Adjusted to be inside scrollable area or handle scrolling */}
            <div className="absolute left-[7px] top-2 bottom-4 w-1 bg-slate-100 rounded-full" />

            {timetable.map((cls) => (
              <div key={cls.id} className="relative pl-10 group pb-2">
                <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-md z-10 transition-all duration-500 group-hover:scale-150 ${cls.status === 'COMPLETED' ? 'bg-slate-300' :
                  cls.status === 'ONGOING' ? 'bg-indigo-500 animate-pulse-glow' : 'bg-emerald-400'
                  }`} />
                <div className="hover:translate-x-2 transition-transform duration-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-black text-slate-800 tracking-tight">{cls.subjectName}</h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center bg-slate-50 px-3 py-1 rounded-full">
                          <Clock className="w-3 h-3 mr-1.5" /> {cls.startTime} - {cls.endTime}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center bg-slate-50 px-3 py-1 rounded-full">
                          <MapPin className="w-3 h-3 mr-1" /> {cls.room}
                        </p>
                      </div>
                    </div>
                    <div>
                      {cls.status === 'COMPLETED' ? (
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                      ) : cls.status === 'ONGOING' ? (
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-100">Live</span>
                      ) : (
                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest">Later</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {timetable.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-slate-300 tracking-tight uppercase">No classes today</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default StudentDashboard;