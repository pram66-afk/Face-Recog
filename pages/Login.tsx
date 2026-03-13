import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, MapPin, ShieldCheck, UserCircle, Lock, AlertCircle, Fingerprint, Wifi } from 'lucide-react';
import { login as apiLogin, AuthUser } from '../services/auth';
import { isApiConfigured } from '../services/api';
import { CURRENT_USER_MOCK } from '../data';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const navigate = useNavigate();

  const apiReady = isApiConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await apiLogin(userId, password);
      onLogin(user);

      switch (user.role) {
        case 'ADMIN': navigate('/admin/dashboard'); break;
        case 'FACULTY': navigate('/faculty/dashboard'); break;
        case 'STUDENT': navigate('/student/dashboard'); break;
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: 'ADMIN' | 'FACULTY' | 'STUDENT') => {
    setLoading(true);
    const mockUser = CURRENT_USER_MOCK[role] as User;

    const authUser: AuthUser = {
      id: mockUser.id,
      name: mockUser.name,
      role: role,
      email: mockUser.email,
      usn: (mockUser as any).usn || '',
      semester: (mockUser as any).semester || '',
      section: (mockUser as any).section || '',
      department: (mockUser as any).department || '',
      avatarInitials: mockUser.avatarInitials,
    };

    sessionStorage.setItem('ams_current_user', JSON.stringify(authUser));

    setTimeout(() => {
      onLogin(authUser);
      switch (role) {
        case 'ADMIN': navigate('/admin/dashboard'); break;
        case 'FACULTY': navigate('/faculty/dashboard'); break;
        case 'STUDENT': navigate('/student/dashboard'); break;
      }
      setLoading(false);
    }, 500);
  };

  const features = [
    { icon: ShieldCheck, text: 'Anti-proxy verification', color: 'text-emerald-400' },
    { icon: MapPin, text: 'GPS geofenced check-ins', color: 'text-amber-400' },
    { icon: Fingerprint, text: 'Biometric ready', color: 'text-purple-400' },
    { icon: Wifi, text: 'Real-time cross-device sync', color: 'text-blue-400' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-white">
      {/* Decorative blobs are now handled by body mesh background in index.css, 
          but we can add extra vibrancy here */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-20 blur-[100px] animate-bop"
        style={{ background: 'var(--primary-light)' }} />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[100px] animate-bop"
        style={{ background: 'var(--success)', animationDelay: '-2s' }} />

      <div className="w-full max-w-5xl flex flex-col lg:flex-row candy-card animate-fade-in relative z-10 p-0 overflow-hidden"
        style={{ minHeight: '600px' }}
      >
        {/* Left Panel - Branding */}
        <div className="lg:w-[42%] p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden border-r border-white/20"
          style={{ background: 'linear-gradient(160deg, rgba(67,97,238,0.12) 0%, rgba(76,201,240,0.08) 100%)' }}
        >
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-200">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-black text-slate-800 tracking-tight">AMS QR</span>
                <p className="text-[10px] text-slate-400 tracking-[0.2em] font-bold">SMART ATTENDANCE</p>
              </div>
            </div>

            <h2 className="text-4xl lg:text-5xl font-black text-slate-800 leading-[1.1] mb-6">
              Attendance<br />Made <span className="text-indigo-600">Smarter.</span>
            </h2>
            <p className="text-slate-500 text-base leading-relaxed max-w-sm font-medium">
              A high-precision, GPS-verified attendance tracking ecosystem for modern VTU institutions.
            </p>
          </div>

          <div className="space-y-4 mt-10 relative z-10">
            {features.map((f, i) => (
              <div key={i} className="flex items-center space-x-4 animate-slide-up bg-white p-3 rounded-2xl border border-slate-100 shadow-sm"
                style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <f.icon className={`w-5 h-5 ${f.color.replace('text-', 'text-indigo-500')}`} style={{ color: !f.color.includes('emerald') && !f.color.includes('amber') ? 'var(--primary)' : undefined }} />
                </div>
                <span className="text-sm font-bold text-slate-700">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="lg:w-[58%] p-10 lg:p-14 bg-white">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-black text-slate-900">Welcome Back</h3>
            <p className="text-slate-500 text-sm mt-2 font-medium">Login to your smart dashboard</p>
          </div>

          {/* Toggle - Pill style */}
          <div className="flex items-center justify-center mb-8 bg-slate-100/80 rounded-full p-1.5 candy-inner max-w-sm mx-auto">
            <button
              onClick={() => setDemoMode(false)}
              className={`flex-1 py-3 px-6 text-sm font-bold rounded-full transition-all duration-500 ${!demoMode ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Real Mode
            </button>
            <button
              onClick={() => setDemoMode(true)}
              className={`flex-1 py-3 px-6 text-sm font-bold rounded-full transition-all duration-500 ${demoMode ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Demo Mode
            </button>
          </div>

          {!demoMode ? (
            <div className="max-w-md mx-auto">
              {!apiReady && (
                <div className="mb-6 bg-blue-50/50 border border-blue-100 rounded-[24px] p-4 flex items-start space-x-3 animate-slide-down">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800 font-medium leading-relaxed">
                    API connection required. Configure <code className="bg-blue-100/50 px-1.5 py-0.5 rounded text-[10px] font-mono">VITE_APPS_SCRIPT_URL</code> in your environment to enable real-time tracking.
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-6 bg-red-50 border border-red-100 rounded-[24px] p-4 flex items-start space-x-3 animate-slide-down">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-500 ml-4 uppercase tracking-[0.1em]">Identity</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                      <UserCircle className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500" />
                    </div>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      className="block w-full pl-14 pr-6 py-4 border border-slate-100 bg-white/80 rounded-[20px] shadow-sm text-slate-800 font-bold placeholder:text-slate-300 transition-all placeholder:font-normal"
                      placeholder="USN or Email ID"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-4">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.1em]">Security</label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-14 pr-6 py-4 border border-slate-100 bg-white/80 rounded-[20px] shadow-sm text-slate-800 font-bold placeholder:text-slate-300 transition-all placeholder:font-normal"
                      placeholder="Your Password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !apiReady}
                  className="w-full py-5 rounded-full text-base font-black text-white btn-primary mt-4 disabled:opacity-40"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Secure Login'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <p className="text-sm text-slate-500 mb-6 text-center font-medium">Select a demo role to experience the portal</p>
              <div className="space-y-4 stagger-children">
                {([
                  { role: 'ADMIN' as const, name: 'Institution Admin', desc: 'Control Panel', icon: '⚡' },
                  { role: 'FACULTY' as const, name: 'Faculty Member', desc: 'Session Control', icon: '🎓' },
                  { role: 'STUDENT' as const, name: 'Student Profile', desc: 'Attendance Card', icon: '📱' },
                ]).map((item) => (
                  <button
                    key={item.role}
                    onClick={() => handleDemoLogin(item.role)}
                    disabled={loading}
                    className="w-full p-5 bg-white border border-slate-100 rounded-[28px] text-left hover:border-indigo-300 hover:bg-white transition-all duration-500 disabled:opacity-50 flex items-center group shadow-sm hover:shadow-xl hover:shadow-indigo-500/10"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                      {item.icon}
                    </div>
                    <div className="ml-5 flex-1">
                      <p className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{item.role}</p>
                      <p className="text-xs text-slate-500 font-bold">{item.name}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                      <ShieldCheck className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;