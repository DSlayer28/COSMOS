import React, { useState } from 'react'
import { getSavedServerUrl, setCustomServerUrl, resetServerUrl } from '../socket'

interface ServerSwitchModalProps {
    isOpen: boolean
    onClose: () => void
}

export function ServerSwitchModal({ isOpen, onClose }: ServerSwitchModalProps) {
    const [inputUrl, setInputUrl] = useState('')
    const currentUrl = getSavedServerUrl()

    if (!isOpen) return null

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        if (inputUrl.trim()) {
            setCustomServerUrl(inputUrl)
            onClose()
        }
    }

    const handleReset = () => {
        resetServerUrl()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cosmos-fade-in">
            <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 text-lg cursor-pointer"
                >
                    ✕
                </button>

                <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-2 text-2xl">
                        📡
                    </div>
                    <h3 className="text-lg font-bold text-white">Server Network IP</h3>
                    <p className="text-xs text-slate-400">
                        Did the server host move to a new network or IP?
                    </p>
                </div>

                <div className="bg-slate-950 border border-white/10 rounded-xl p-3 mb-4">
                    <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Current Target Server</div>
                    <div className="text-xs font-mono text-indigo-300 truncate">{currentUrl}</div>
                </div>

                <form onSubmit={handleSave} className="space-y-3 mb-4">
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                            Enter New Server IP or PC Hostname
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 192.168.0.45 or desktop-abc"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/60"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!inputUrl.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                    >
                        Connect to New Server →
                    </button>
                </form>

                <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        Reset to Default URL
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
