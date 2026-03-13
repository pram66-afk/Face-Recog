import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Key, AlertCircle, CheckCircle2, QrCode, ArrowLeft } from 'lucide-react';
import { changePassword, AuthUser } from '../services/auth';

interface ChangePasswordProps {
    authUser: AuthUser | null;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ authUser }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!authUser) {
            setError('You must be logged in to change your password.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            await changePassword(authUser.id, oldPassword, newPassword);
            setSuccess(true);
            setTimeout(() => {
                navigate(`/${authUser.role.toLowerCase()}/dashboard`);
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to change password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-2xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Security</h1>
                    <p className="text-slate-500 font-medium">Manage your account credentials</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Lock className="w-6 h-6" />
                </div>
            </div>

            <div className="candy-card p-8 lg:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <QrCode className="w-32 h-32" />
                </div>

                <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center">
                    <Key className="w-5 h-5 mr-3 text-indigo-500" />
                    Change Password
                </h2>

                {success ? (
                    <div className="text-center py-6 animate-scale-in">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Password Updated!</h3>
                        <p className="text-slate-500 font-medium mb-6">Your security credentials have been successfully changed.</p>
                        <div className="flex items-center justify-center text-sm text-indigo-600 font-bold">
                            Redirecting to dashboard...
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 rounded-[20px] p-4 flex items-start space-x-3 animate-slide-down">
                                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-red-700 font-bold">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 ml-4 uppercase tracking-[0.1em]">Current Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500" />
                                </div>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="block w-full pl-14 pr-6 py-4 border border-slate-100 bg-white/50 rounded-[20px] shadow-sm text-slate-800 font-bold placeholder:text-slate-300 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-500 ml-4 uppercase tracking-[0.1em]">New Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                        <Key className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500" />
                                    </div>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="block w-full pl-14 pr-6 py-4 border border-slate-100 bg-white/50 rounded-[20px] shadow-sm text-slate-800 font-bold placeholder:text-slate-300 transition-all"
                                        placeholder="Min. 6 characters"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-500 ml-4 uppercase tracking-[0.1em]">Confirm Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                        <CheckCircle2 className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500" />
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="block w-full pl-14 pr-6 py-4 border border-slate-100 bg-white/50 rounded-[20px] shadow-sm text-slate-800 font-bold placeholder:text-slate-300 transition-all"
                                        placeholder="Repeat new password"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-5 rounded-full text-base font-black text-white btn-primary disabled:opacity-40"
                            >
                                {loading ? (
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                                ) : (
                                    'Update Password'
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="px-8 py-5 rounded-full text-base font-black text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-center"
                            >
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ChangePassword;
