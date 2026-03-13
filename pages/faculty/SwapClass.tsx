import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, ArrowRightLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { AuthUser } from '../../services/auth';
import { getSwappableClasses, swapClass, SwappableClass } from '../../services/faculty';
import { formatTime } from '../../utils';

interface SwapClassProps {
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
    semester?: number;
    room: string;
    status: string;
}

const SwapClass: React.FC<SwapClassProps> = ({ authUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const sourceClass = location.state?.sourceClass as TimetableItem | undefined;

    const [loading, setLoading] = useState(true);
    const [swappableClasses, setSwappableClasses] = useState<SwappableClass[]>([]);
    const [swappingId, setSwappingId] = useState<string | null>(null);
    const [swapSuccess, setSwapSuccess] = useState(false);
    const [targetClassForShare, setTargetClassForShare] = useState<SwappableClass | null>(null);

    useEffect(() => {
        if (!sourceClass) {
            navigate('/faculty/dashboard');
            return;
        }
        fetchSwappable();
    }, [sourceClass]);

    const fetchSwappable = async () => {
        if (!sourceClass) return;
        try {
            const classes = await getSwappableClasses(sourceClass.id);
            setSwappableClasses(classes);
        } catch (e) {
            console.error(e);
            alert('Failed to fetch swappable classes');
        } finally {
            setLoading(false);
        }
    };

    const handleSwap = async (targetClass: SwappableClass) => {
        if (!sourceClass || !authUser) return;

        if (!window.confirm(`Swap ${sourceClass.subjectName} with ${targetClass.subjectName}?`)) return;

        setSwappingId(targetClass.id);
        setTargetClassForShare(targetClass);
        try {
            const res = await swapClass({
                sourceTTId: sourceClass.id,
                targetTTId: targetClass.id,
                initiatorId: authUser.id
            });

            if (res.success) {
                setSwapSuccess(true);
                // navigate('/faculty/dashboard'); // Don't navigate yet
            } else {
                alert('Swap failed: ' + res.message);
            }
        } catch (e) {
            console.error(e);
            alert('An error occurred during swap.');
        } finally {
            setSwappingId(null);
        }
    };

    if (!sourceClass) return null;

    if (swapSuccess && targetClassForShare) {
        const message = `🔄 *Class Swapped*\n\nThe class *${sourceClass.subjectName}* has been swapped with *${targetClassForShare.subjectName}*.\n\nNew Schedule:\n- ${sourceClass.subjectName}: ${formatTime(targetClassForShare.startTime)}\n- ${targetClassForShare.subjectName}: ${formatTime(sourceClass.startTime)}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

        return (
            <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-3xl text-center shadow-xl animate-scale-in">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Swap Successful!</h2>
                <p className="text-slate-500 mb-8">The timetable has been updated and notifications sent.</p>

                <div className="space-y-3">
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full py-3.5 bg-[#25D366] text-white rounded-xl font-bold shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all transform hover:-translate-y-1 flex items-center justify-center"
                    >
                        Share to WhatsApp Group
                    </a>
                    <button
                        onClick={() => navigate('/faculty/dashboard')}
                        className="block w-full py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in p-4 pb-20">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Swap Class</h1>
                    <p className="text-slate-500 text-sm">Select a class to exchange time slots with</p>
                </div>
            </div>

            {/* Source Class Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider mb-2 backdrop-blur-sm">
                            Current Class
                        </span>
                        <h2 className="text-2xl font-bold text-white">{sourceClass.subjectName}</h2>
                        <p className="text-indigo-100 text-sm mt-1">{sourceClass.subjectCode}</p>
                    </div>
                    <div className="text-right">
                        <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg">
                            <p className="text-lg font-bold">{formatTime(sourceClass.startTime)}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                        <p className="text-xs text-indigo-200 uppercase font-medium mb-1">Section</p>
                        <p className="font-semibold">{sourceClass.section} {sourceClass.semester ? `(Sem ${sourceClass.semester})` : ''}</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                        <p className="text-xs text-indigo-200 uppercase font-medium mb-1">Room</p>
                        <p className="font-semibold flex items-center"><MapPin className="w-3 h-3 mr-1" /> {sourceClass.room}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-4 py-2">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Available Options</span>
                <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            {/* Target Classes List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                        <p className="text-slate-500 text-sm">Finding swappable classes...</p>
                    </div>
                ) : swappableClasses.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium">No classes available for swap</p>
                        <p className="text-slate-400 text-sm mt-1">There do not seem to be other eligible classes in this section/semester today.</p>
                    </div>
                ) : (
                    swappableClasses.map((cls) => (
                        <div
                            key={cls.id}
                            className="group bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="flex justify-between items-center relative z-10">
                                <div className="flex-1">
                                    <div className="flex items-center mb-1">
                                        <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{cls.subjectName}</h3>
                                        {cls.facultyId === authUser?.id && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">Your Class</span>}
                                    </div>
                                    <div className="flex items-center text-sm text-slate-500 space-x-4">
                                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> {formatTime(cls.startTime)} - {formatTime(cls.endTime)}</span>
                                        <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> {cls.room}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSwap(cls)}
                                    disabled={!!swappingId}
                                    className={`ml-4 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center transition-all ${swappingId === cls.id
                                        ? 'bg-indigo-100 text-indigo-700 cursor-wait'
                                        : 'bg-slate-50 text-slate-600 hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-500/30'
                                        }`}
                                >
                                    {swappingId === cls.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <span>Swap</span>
                                            <ArrowRightLeft className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SwapClass;
