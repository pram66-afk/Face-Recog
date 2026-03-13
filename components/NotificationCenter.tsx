import React, { useState, useEffect } from 'react';
import { Bell, Check, Clock, AlertCircle } from 'lucide-react';
import { getNotifications, markNotificationRead, Notification } from '../services/faculty';

interface NotificationCenterProps {
    userId: string;
    onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId, onClose }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
    }, [userId]);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await getNotifications(userId);
            setNotifications(data);
        } catch (error) {
            console.error('Failed to load notifications', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.error('Failed to mark read', error);
        }
    };

    const pendingCount = notifications.filter(n => !n.read).length;

    return (
        <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">Notifications</h2>
                        {pendingCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                {pendingCount}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        Close
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                            <span className="text-sm">Loading...</span>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <Bell className="w-8 h-8 mb-2 opacity-20" />
                            <p>No notifications yet</p>
                        </div>
                    ) : (
                        notifications.map((note) => (
                            <div
                                key={note.id}
                                className={`p-3 rounded-lg border transition-all duration-200 ${note.read
                                    ? 'bg-white border-gray-200 text-gray-500'
                                    : 'bg-white border-indigo-200 shadow-sm border-l-4 border-l-indigo-500'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`text-sm font-semibold ${note.read ? 'text-gray-600' : 'text-gray-800'}`}>
                                        {note.title}
                                    </h4>
                                    {!note.read && (
                                        <button
                                            onClick={(e) => handleMarkRead(note.id, e)}
                                            className="text-indigo-600 hover:text-indigo-800"
                                            title="Mark as read"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                                    {note.message}
                                </p>
                                <div className="flex items-center text-[10px] text-gray-400 gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{new Date(note.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationCenter;
