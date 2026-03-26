import React, { useState, useEffect } from 'react';
import { Loader2, Clock, MapPin, Calendar, Users } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import { isApiConfigured, apiGet } from '../../services/api';
import { TODAY_TIMETABLE, SUBJECTS, FACULTY_MEMBERS } from '../../data';
import { TimetableEntry } from '../../types';

const TIMETABLE_STORAGE_KEY = 'ams_timetable';

interface TTEntry {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    subjectName: string;
    subjectCode: string;
    facultyName: string;
    section: string;
    room: string;
}

const AdminTimetable: React.FC = () => {
    const apiReady = isApiConfigured();
    const [loading, setLoading] = useState(true);
    const [timetable, setTimetable] = useState<TTEntry[]>([]);
    const [selectedDay, setSelectedDay] = useState<string>('Monday');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    useEffect(() => { loadTimetable(); }, [selectedDay]);

    const loadTimetable = async () => {
        setLoading(true);
        if (apiReady) {
            try {
                const result = await apiGet('getTimetable', { day: selectedDay });
                if (result.success) {
                    setTimetable(result.timetable.map((t: any) => ({
                        id: t.id, day: t.day, startTime: t.startTime, endTime: t.endTime,
                        subjectName: t.subjectName || t.subjectCode, subjectCode: t.subjectCode,
                        facultyName: t.facultyName || t.facultyId || '', section: t.section, room: t.room,
                    })));
                }
            } catch (err) { console.error(err); fallback(); }
        } else { fallback(); }
        setLoading(false);
    };

    const fallback = () => {
        const stored = localStorage.getItem(TIMETABLE_STORAGE_KEY);
        const entries: TimetableEntry[] = stored ? JSON.parse(stored) : TODAY_TIMETABLE;
        setTimetable(entries.map(e => ({
            id: e.id, day: e.dayOfWeek, startTime: e.startTime, endTime: e.endTime,
            subjectName: SUBJECTS.find(s => s.id === e.subjectId)?.name || e.subjectId,
            subjectCode: e.subjectId,
            facultyName: FACULTY_MEMBERS.find(f => f.id === e.facultyId)?.name || e.facultyId,
            section: e.section, room: e.room,
        })));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Timetable</h2>
                <p className="text-sm text-slate-500 mt-0.5">View class schedules by day</p>
            </div>

            {/* Day Selector */}
            <div className="flex space-x-2 overflow-x-auto pb-1 -mx-1 px-1">
                {days.map(day => (
                    <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${selectedDay === day
                            ? 'gradient-primary text-white shadow-md shadow-blue-500/20'
                            : 'bg-white text-slate-600 hover:bg-white hover:shadow-sm border border-slate-200/60'
                            }`}
                    >
                        {day.slice(0, 3)}
                    </button>
                ))}
            </div>

            {loading ? (
                <LoadingScreen />
            ) : timetable.length === 0 ? (
                <div className="candy-card p-12 text-center">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-400">No classes on {selectedDay}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
                    {timetable.map(entry => (
                        <div key={entry.id} className="candy-card p-5 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full rounded-r-full gradient-accent" />
                            <div className="ml-3">
                                <h3 className="text-base font-bold text-slate-900 mb-0.5">{entry.subjectName}</h3>
                                <p className="text-[11px] text-slate-500 font-mono">{entry.subjectCode}</p>

                                <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                                    <div className="flex items-center">
                                        <Clock className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                        {entry.startTime} - {entry.endTime}
                                    </div>
                                    <div className="flex items-center">
                                        <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                        {entry.room} • Section {entry.section}
                                    </div>
                                </div>

                                {entry.facultyName && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs text-slate-500">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center mr-2 flex-shrink-0">
                                            <Users className="w-3 h-3 text-indigo-600" />
                                        </div>
                                        <span className="font-medium text-slate-700">{entry.facultyName}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminTimetable;
