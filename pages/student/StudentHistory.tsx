import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Loader2, CalendarDays, CheckCircle, XCircle } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import { useNavigate } from 'react-router-dom';
import { AuthUser } from '../../services/auth';
import { isApiConfigured } from '../../services/api';
import { getStudentHistory, HistoryEntry } from '../../services/attendance';

interface StudentHistoryProps {
    authUser: AuthUser | null;
}

const StudentHistory: React.FC<StudentHistoryProps> = ({ authUser }) => {
    const navigate = useNavigate();
    const apiReady = isApiConfigured();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all');

    useEffect(() => { loadHistory(); }, []);

    const loadHistory = async () => {
        if (apiReady) {
            try {
                const data = await getStudentHistory(authUser?.usn || authUser?.id || '');
                setHistory(data);
            } catch (err) { console.error('Failed to load history:', err); setHistory(getMockHistory()); }
        } else { setHistory(getMockHistory()); }
        setLoading(false);
    };

    const getMockHistory = (): HistoryEntry[] => [
        { subjectCode: '18CS61', subjectName: 'System Software', date: '2025-02-14', status: 'PRESENT' },
        { subjectCode: '18CS62', subjectName: 'Computer Graphics', date: '2025-02-14', status: 'PRESENT' },
        { subjectCode: '18CS63', subjectName: 'Web Technology', date: '2025-02-13', status: 'ABSENT' },
        { subjectCode: '18CS61', subjectName: 'System Software', date: '2025-02-13', status: 'PRESENT' },
        { subjectCode: '18CS64', subjectName: 'Data Mining', date: '2025-02-12', status: 'PRESENT' },
        { subjectCode: '18CS65', subjectName: 'Cloud Computing', date: '2025-02-12', status: 'PRESENT' },
        { subjectCode: '18CS62', subjectName: 'Computer Graphics', date: '2025-02-11', status: 'ABSENT' },
        { subjectCode: '18CS63', subjectName: 'Web Technology', date: '2025-02-11', status: 'PRESENT' },
    ];

    const filtered = history
        .filter(h => filter === 'all' || (filter === 'present' && h.status === 'PRESENT') || (filter === 'absent' && h.status === 'ABSENT'))
        .filter(h => search === '' || h.subjectName.toLowerCase().includes(search.toLowerCase()) || h.subjectCode.toLowerCase().includes(search.toLowerCase()));

    const presentCount = history.filter(h => h.status === 'PRESENT').length;
    const absentCount = history.filter(h => h.status === 'ABSENT').length;

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="space-y-4 sm:space-y-8 max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/student/dashboard')}
                        className="w-12 h-12 flex items-center justify-center bg-white text-slate-600 rounded-2xl shadow-xl shadow-slate-200 hover:scale-110 active:scale-95 transition-all duration-300 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Attendance History</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Review your records</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats - Candy Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                    { label: 'Total Sessions', value: history.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Days Present', value: presentCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Days Absent', value: absentCount, color: 'text-red-500', bg: 'bg-red-50' }
                ].map(stat => (
                    <div key={stat.label} className="candy-card p-5 sm:p-8 flex flex-col items-center text-center">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2 sm:mb-4">{stat.label}</span>
                        <p className={`text-3xl sm:text-4xl font-black ${stat.color}`}>{stat.value}</p>
                        <div className={`w-8 h-1 rounded-full ${stat.bg.replace('bg-', 'bg-').split('-')[1] === 'indigo' ? 'bg-indigo-500' : stat.bg.replace('bg-', 'bg-').split('-')[1] === 'emerald' ? 'bg-emerald-400' : 'bg-red-400'} mt-3 sm:mt-4`} />
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex flex-col lg:flex-row gap-6 px-1">
                <div className="relative flex-1 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10" />
                    <input
                        type="text" placeholder="Search by subject code or name..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 bg-white rounded-[28px] border-transparent shadow-xl shadow-slate-200/50 focus:shadow-indigo-500/10 focus:bg-white transition-all text-base font-bold placeholder:text-slate-300"
                    />
                </div>
                <div className="flex bg-slate-50 p-2 rounded-[32px] shadow-inner">
                    {(['all', 'present', 'absent'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-8 py-3 rounded-full text-xs font-black capitalize transition-all duration-500 ${filter === f
                                ? 'gradient-primary text-white shadow-xl shadow-indigo-500/20'
                                : 'text-slate-400 hover:text-indigo-600'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table - Candy Style */}
            <div className="candy-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="text-left px-4 sm:px-8 py-4 sm:py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                                <th className="text-left px-4 sm:px-8 py-4 sm:py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Subject Information</th>
                                <th className="text-center px-4 sm:px-8 py-4 sm:py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Attendance Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="text-center py-24">
                                        <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                            <CalendarDays className="w-10 h-10 text-slate-200" />
                                        </div>
                                        <p className="text-xl font-black text-slate-300 tracking-tight">No records found matching your search</p>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/30 transition-all duration-300 group cursor-default">
                                        <td className="px-4 sm:px-8 py-4 sm:py-6">
                                            <span className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-tighter">{entry.date}</span>
                                        </td>
                                        <td className="px-4 sm:px-8 py-4 sm:py-6">
                                            <div className="text-base sm:text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{entry.subjectCode}</div>
                                            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">{entry.subjectName}</div>
                                        </td>
                                        <td className="px-4 sm:px-8 py-4 sm:py-6 text-center">
                                            <span className={`inline-flex items-center px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm ${entry.status === 'PRESENT'
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : 'bg-red-50 text-red-500'
                                                }`}>
                                                {entry.status === 'PRESENT' ? (
                                                    <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5 sm:mr-2" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1.5 sm:mr-2" />
                                                )}
                                                {entry.status}
                                            </span>
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

export default StudentHistory;
