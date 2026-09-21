import { useState } from 'react'

export function UsernamePrompt({ onJoined }: { onJoined: (name: string) => void }) {
    const [inputName, setInputName] = useState('')
    const [focused, setFocused] = useState(false)

    const handleJoin = () => {
        const name = inputName.trim()
        if (!name) return
        localStorage.setItem('chat-username', name)
        onJoined(name)
    }

    return (
        <div className="min-h-svh bg-[#020617] flex items-center justify-center px-4 py-10 relative overflow-hidden">
            {/* Multi-layer cosmic background */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Deep space gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-[#020617] to-violet-950/30" />
                {/* Primary glow orb */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]" />
                {/* Secondary accent orbs */}
                <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-violet-600/8 rounded-full blur-[80px]" />
                <div className="absolute bottom-1/3 left-1/4 w-48 h-48 bg-blue-600/8 rounded-full blur-[60px]" />
                {/* Star field dots */}
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-0.5 h-0.5 bg-white/20 rounded-full"
                        style={{
                            top: `${Math.sin(i * 137.5) * 50 + 50}%`,
                            left: `${Math.cos(i * 137.5) * 50 + 50}%`,
                            opacity: 0.1 + (i % 5) * 0.08,
                        }}
                    />
                ))}
            </div>

            {/* Card */}
            <div className="relative w-full max-w-[420px] cosmos-fade-in">
                {/* Glow ring behind card */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600/20 via-violet-600/15 to-indigo-600/20 rounded-[28px] blur-xl opacity-60" />

                <div className="relative bg-slate-900/80 border border-white/[0.07] rounded-[24px] p-8 shadow-2xl backdrop-blur-2xl">
                    {/* Brand header */}
                    <div className="text-center mb-8">
                        {/* Logo icon */}
                        <div className="relative inline-flex mb-5">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 cosmos-float">
                                <span className="text-3xl">🌐</span>
                            </div>
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/40 to-violet-600/40 blur-lg -z-10" />
                        </div>

                        <h1 className="text-3xl font-black text-white tracking-tight mb-1">
                            COSMOS
                        </h1>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-400 mb-3">
                            Disaster Response Platform
                        </p>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                            Enter your name to join the network and coordinate with others nearby.
                        </p>
                    </div>

                    {/* Input */}
                    <div className="relative mb-4">
                        <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${focused && inputName ? 'bg-indigo-500/10 shadow-[0_0_0_1px_rgba(99,102,241,0.5)]' : 'bg-white/[0.03]'}`} />
                        <input
                            id="username-input"
                            type="text"
                            placeholder="Your name..."
                            value={inputName}
                            onChange={e => setInputName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleJoin()}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            autoComplete="off"
                            autoFocus
                            className="relative w-full bg-transparent text-white placeholder-slate-500 border border-white/10 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500/60 transition-colors duration-200"
                        />
                    </div>

                    {/* CTA button */}
                    <button
                        id="join-btn"
                        onClick={handleJoin}
                        disabled={!inputName.trim()}
                        className="group w-full relative overflow-hidden rounded-xl py-3.5 font-semibold text-sm transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {/* Button background */}
                        <div className="absolute inset-0 bg-[#FFFDD0] group-hover:bg-white transition-colors duration-200" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out" />
                        <span className="relative text-slate-900 font-bold">
                            Enter COSMOS →
                        </span>
                    </button>

                    {/* Footer */}
                    <p className="text-center text-slate-600 text-[11px] mt-5 leading-relaxed">
                        Works offline · No internet required · LAN only
                    </p>
                </div>
            </div>
        </div>
    )
}
