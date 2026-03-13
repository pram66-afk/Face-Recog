import React, { useState, useEffect } from 'react';
import { Loader2, CalendarCheck, Users, FileText } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import { AuthUser } from '../../services/auth';
import { isApiConfigured, apiGet } from '../../services/api';

interface FacultyRecordsProps {
    authUser: AuthUser | null;
}

interface SessionRecord {
    sessionId: string;
    subjectName: string;
    subjectCode: string;
    room: string;
    section: string;
    startTime: string;
    endTime: string;
    status: string;
    studentCount: number;
}

const FacultyRecords: React.FC<FacultyRecordsProps> = ({ authUser }) => {
    const apiReady = isApiConfigured();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<SessionRecord[]>([]);

    useEffect(() => { loadRecords(); }, []);

    const loadRecords = async () => {
        if (apiReady) {
            try {
                const result = await apiGet('getFacultyRecords', { facultyId: authUser?.id || '' });
                if (result.success) setRecords(result.records);
            } catch (err) { console.error(err); fallback(); }
        } else { fallback(); }
        setLoading(false);
    };

    const fallback = () => {
        setRecords([
            { sessionId: 's1', subjectName: 'System Software', subjectCode: '18CS61', room: 'LH-101', section: '6A', startTime: '2025-02-14 09:00', endTime: '2025-02-14 10:00', status: 'COMPLETED', studentCount: 54 },
            { sessionId: 's2', subjectName: 'Computer Graphics', subjectCode: '18CS62', room: 'LH-102', section: '6A', startTime: '2025-02-14 11:00', endTime: '2025-02-14 12:00', status: 'COMPLETED', studentCount: 48 },
            { sessionId: 's3', subjectName: 'Web Technology', subjectCode: '18CS63', room: 'LH-103', section: '6B', startTime: '2025-02-13 14:00', endTime: '2025-02-13 15:00', status: 'COMPLETED', studentCount: 52 },
        ]);
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Session Records</h2>
                <p className="text-sm text-slate-500 mt-0.5">Your past attendance sessions</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 stagger-children">
                <div className="candy-card p-4 flex items-center space-x-3 transition-all hover:scale-[1.05]">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/15 flex-shrink-0 animate-bop">
                        <CalendarCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-xl font-black text-slate-900 leading-tight">{records.length}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Sessions</p>
                    </div>
                </div>
                <div className="candy-card p-4 flex items-center space-x-3 transition-all hover:scale-[1.05]">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/15 flex-shrink-0 animate-bop" style={{ animationDelay: '0.2s' }}>
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-xl font-black text-slate-900 leading-tight">{records.reduce((sum, r) => sum + r.studentCount, 0)}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Scans</p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="candy-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
                                <th className="text-left px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Room</th>
                                <th className="text-left px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Date/Time</th>
                                <th className="text-center px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Students</th>
                                <th className="text-center px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 stagger-children">
                            {records.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-slate-400">
                                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm font-medium">No records yet</p>
                                </td></tr>
                            ) : (
                                records.map(r => (
                                    <tr key={r.sessionId} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-4 sm:px-6 py-3">
                                            <div className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{r.subjectName}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{r.subjectCode} • Sec {r.section}</div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 text-xs text-slate-500 font-bold hidden sm:table-cell">{r.room}</td>
                                        <td className="px-4 sm:px-6 py-3 text-xs text-slate-500 font-bold hidden md:table-cell">{r.startTime}</td>
                                        <td className="px-4 sm:px-6 py-3 text-center text-sm font-black text-slate-900">{r.studentCount}</td>
                                        <td className="px-4 sm:px-6 py-3 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${r.status === 'COMPLETED' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'
                                                }`}>{r.status}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FacultyRecords;
