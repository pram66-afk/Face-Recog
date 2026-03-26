import React from 'react';

const LoadingScreen: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full animate-fade-in">
            <div className="relative w-64 h-64 mb-8">
                {/* Decorative background glow */}
                <div className="absolute inset-0 bg-indigo-500/10 blur-[60px] rounded-full animate-pulse" />

                {/* The Illustration */}
                <img
                    src="/assets/loading.png"
                    alt="Loading..."
                    className="w-full h-full object-contain relative z-10 animate-bop"
                />
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Syncing Data</h3>
                <p className="text-slate-400 font-bold text-sm tracking-wide flex items-center justify-center">
                    <span className="flex space-x-1 mr-2">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                    </span>
                    Please wait a moment
                </p>
            </div>
        </div>
    );
};

export default LoadingScreen;
