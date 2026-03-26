import React, { useState, useEffect } from 'react';
import { Search, Loader2, AlertTriangle, CheckCircle, Users } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';
import { isApiConfigured, apiGet } from '../../services/api';
import { STUDENTS } from '../../data';

interface StudentRecord {
    usn: string;
    name: string;
    email: string;
    semester: string;
    section: string;
    attendance: number;
}

const AdminStudents: React.FC = () => {
    const apiReady = isApiConfigured();
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => { loadStudents(); }, []);

    const loadStudents = async () => {
        if (apiReady) {
            try {
                const result = await apiGet('getAdminStats');
                if (result.success && result.students) setStudents(result.students);
            } catch (err) { console.error('Failed to load:', err); fallback(); }
        } else { fallback(); }
        setLoading(false);
    };

    const fallback = () => {
        setStudents(STUDENTS.map(s => ({
            usn: s.usn, name: s.name, email: s.email,
            semester: s.semester.toString(), section: s.section,
            attendance: Math.floor(Math.random() * 30) + 70,
        })));
    };

    const filtered = students.filter(s =>
        search === '' || s.name.toLowerCase().includes(search.toLowerCase()) || s.usn.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Student Records</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{students.length} students enrolled</p>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name or USN..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white transition-all hover:border-slate-300 focus:bg-white"
                    />
                </div>
            </div>

            <div className="candy-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">USN</th>
                                <th className="text-left px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                                <th className="text-left px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                                <th className="text-center px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Sem</th>
                                <th className="text-center px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Sec</th>
                                <th className="text-center px-4 sm:px-6 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Attendance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-400">
                                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm font-medium">No students found</p>
                                </td></tr>
                            ) : (
                                filtered.map(s => (
                                    <tr key={s.usn} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 sm:px-6 py-3 text-xs font-mono text-indigo-600 font-semibold">{s.usn}</td>
                                        <td className="px-4 sm:px-6 py-3 text-sm font-semibold text-slate-900">{s.name}</td>
                                        <td className="px-4 sm:px-6 py-3 text-xs text-slate-500 hidden md:table-cell">{s.email}</td>
                                        <td className="px-4 sm:px-6 py-3 text-xs text-center text-slate-700 hidden sm:table-cell">{s.semester}</td>
                                        <td className="px-4 sm:px-6 py-3 text-xs text-center text-slate-700 hidden sm:table-cell">{s.section}</td>
                                        <td className="px-4 sm:px-6 py-3 text-center">
                                            <div className="flex items-center justify-center space-x-1.5">
                                                <span className={`font-bold text-sm ${s.attendance < 85 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                                    {s.attendance}%
                                                </span>
                                                {s.attendance < 85 ? (
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                                ) : (
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                )}
                                            </div>
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

export default AdminStudents;
