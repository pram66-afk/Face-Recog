import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { forgotPassword } from '../services/auth';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await forgotPassword(email);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Failed to request password recovery. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-white">
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-20 blur-[100px]"
                style={{ background: 'var(--primary-light)' }} />
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
                style={{ background: 'var(--success)', animationDelay: '-2s' }} />

            <div className="w-full max-w-lg candy-card animate-fade-in relative z-10 p-10 overflow-hidden">
                <div className="flex items-center space-x-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                        <QrCode className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-black text-slate-800 tracking-tight">AMS QR</span>
                </div>

                <button
                    onClick={() => navigate('/')}
                    className="flex items-center text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                </button>

                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900">Forgot Password?</h1>
                    <p className="text-slate-500 text-sm mt-2 font-medium">
                        Enter your registered email address to receive your password recovery details.
                    </p>
                </div>

                {success ? (
                    <div className="text-center py-8 animate-scale-in">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-3">Check Your Inbox</h2>
                        <p className="text-slate-500 font-medium mb-8">
                            We've sent the password recovery details to <strong>{email}</strong>.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full py-5 rounded-full text-base font-black text-white btn-primary"
                        >
                            Return to Login
                        </button>
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
                            <label className="block text-xs font-black text-slate-500 ml-4 uppercase tracking-[0.1em]">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-14 pr-6 py-4 border border-slate-100 bg-white/80 rounded-[20px] shadow-sm text-slate-800 font-bold placeholder:text-slate-300 transition-all placeholder:font-normal"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 rounded-full text-base font-black text-white btn-primary mt-4 disabled:opacity-40"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                            ) : (
                                'Send Recovery Email'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
