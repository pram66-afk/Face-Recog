import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Plus, CheckCircle, X, BookOpen } from 'lucide-react';
import { AuthUser } from '../../services/auth';
import { isApiConfigured } from '../../services/api';
import { apiGet, apiPost } from '../../services/api';

interface AddClassProps {
    authUser: AuthUser | null;
}

const AddClass: React.FC<AddClassProps> = ({ authUser }) => {
    const navigate = useNavigate();
    const apiReady = isApiConfigured();

    const [subjects, setSubjects] = useState<{ code: string; name: string }[]>([]);
    const [newClassSubject, setNewClassSubject] = useState('');
    const [newClassStart, setNewClassStart] = useState('');
    const [newClassEnd, setNewClassEnd] = useState('');
    const [newClassRoom, setNewClassRoom] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [addError, setAddError] = useState('');

    useEffect(() => {
        if (apiReady) {
            loadSubjects();
        }
    }, []);

    const loadSubjects = async () => {
        try {
            const result = await apiGet('getSubjects', { facultyId: authUser?.id || '' });
            if (result.success && result.subjects.length > 0) {
                setSubjects(result.subjects.map((s: any) => ({ code: s.code, name: s.name })));
                setNewClassSubject(result.subjects[0].code);
            } else {
                setSubjects([]);
                setNewClassSubject('');
            }
        } catch (err) { console.error('Failed to load subjects:', err); }
    };

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setAddError('');
        const subjectInfo = subjects.find(s => s.code === newClassSubject);
        if (apiReady) {
            try {
                const result = await apiPost('addClass', {
                    action: 'addClass', startTime: newClassStart, endTime: newClassEnd,
                    subjectCode: newClassSubject, subjectName: subjectInfo?.name || '',
                    facultyId: authUser?.id || '', section: '6A', room: newClassRoom || 'LH-101',
                });
                if (!result.success) {
                    setAddError(result.error || 'Failed to add class');
                    setSubmitting(false);
                    return;
                }
                navigate('/faculty/dashboard');
            } catch (err) {
                console.error('Failed to add class:', err);
                setAddError('Failed to add class. Please try again.');
            }
        } else {
            navigate('/faculty/dashboard');
        }
        setSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-500 overflow-hidden"
                onClick={() => navigate('/faculty/dashboard')}
            >
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] animate-bop" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] animate-bop" style={{ animationDelay: '-2s' }} />
            </div>

            {/* Card */}
            <div className="candy-card w-full max-w-md p-8 sm:p-10 animate-scale-in relative z-10">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Add New Class</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Session Scheduler</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/faculty/dashboard')}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all duration-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleAddClass} className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-400 ml-4 uppercase tracking-[0.2em]">Subject</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                <BookOpen className="h-5 w-5 text-slate-400" />
                            </div>
                            <select
                                className="w-full pl-14 pr-6 py-4 appearance-none"
                                value={newClassSubject}
                                onChange={(e) => setNewClassSubject(e.target.value)}
                            >
                                {subjects.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-400 ml-4 uppercase tracking-[0.2em]">Start Time</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                    <Clock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="time"
                                    required
                                    className="w-full pl-14 pr-5 py-4"
                                    value={newClassStart}
                                    onChange={(e) => setNewClassStart(e.target.value)}
                                />
                                {newClassStart && (
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                            {new Date(`2000-01-01T${newClassStart}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-400 ml-4 uppercase tracking-[0.2em]">End Time</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                    <Clock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="time"
                                    required
                                    className="w-full pl-14 pr-5 py-4"
                                    value={newClassEnd}
                                    onChange={(e) => setNewClassEnd(e.target.value)}
                                />
                                {newClassEnd && (
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                            {new Date(`2000-01-01T${newClassEnd}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-400 ml-4 uppercase tracking-[0.2em]">Room / Location</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                <MapPin className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="e.g. LH-202"
                                className="w-full pl-14 pr-6 py-4"
                                value={newClassRoom}
                                onChange={(e) => setNewClassRoom(e.target.value)}
                            />
                        </div>
                    </div>

                    {addError && (
                        <p className="text-xs text-red-500 font-bold bg-red-50 px-4 py-3 rounded-2xl animate-shake">{addError}</p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full btn-primary py-5 rounded-[20px] text-base"
                    >
                        {submitting ? (
                            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <div className="flex items-center">
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Add to Schedule
                            </div>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddClass;
