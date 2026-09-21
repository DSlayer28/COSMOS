import React, { useState } from 'react';
import type { RequestCategory } from '../../../../backend/src/shared/types';
import { socket } from '../socket';

interface RequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    lat: number;
    lng: number;
    initialCategory?: RequestCategory | null;
}

const CATEGORIES: { id: RequestCategory; label: string; icon: string }[] = [
    { id: 'medical',     label: 'Medical',    icon: '🏥' },
    { id: 'rescue',      label: 'Rescue',     icon: '🚁' },
    { id: 'medicine',    label: 'Medicine',   icon: '💊' },
    { id: 'water',       label: 'Water',      icon: '💧' },
    { id: 'food',        label: 'Food',       icon: '🥫' },
    { id: 'shelter',     label: 'Shelter',    icon: '⛺' },
    { id: 'sanitation',  label: 'Sanitation', icon: '🚿' },
    { id: 'transport',   label: 'Transport',  icon: '🚗' },
    { id: 'information', label: 'Info',       icon: 'ℹ️' },
];

export function RequestModal({ isOpen, onClose, lat, lng, initialCategory }: RequestModalProps) {
    const [category, setCategory] = useState<RequestCategory | null>(initialCategory || null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [peopleAffected, setPeopleAffected] = useState<number | ''>(1);
    const [expiryHours, setExpiryHours] = useState<number>(24);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen && initialCategory) {
            setCategory(initialCategory);
        }
    }, [isOpen, initialCategory]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!category) { setError('Please select a category.'); return; }
        if (!title.trim() || !description.trim()) { setError('Title and description are required.'); return; }

        socket.emit('create-request', {
            category,
            title,
            description,
            peopleAffected: Number(peopleAffected) || 1,
            lat,
            lng,
            expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000)
        });

        setCategory(null); setTitle(''); setDescription('');
        setPeopleAffected(1); setExpiryHours(24); setError('');
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />

            {/* Panel — full width on mobile, constrained on sm+ */}
            <div className="relative w-full sm:max-w-lg bg-slate-900 border border-white/[0.07] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
                {/* Top drag indicator (mobile) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 bg-white/10 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-white/[0.06]">
                    <div>
                        <h2 className="text-white font-bold text-base">Create Request</h2>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                            {lat.toFixed(4)}, {lng.toFixed(4)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center text-xl font-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                        aria-label="Close modal"
                    >×</button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto max-h-[70vh] sm:max-h-none">
                    <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-5">
                        {/* Error */}
                        {error && (
                            <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 p-3 rounded-xl">
                                {error}
                            </div>
                        )}

                        {/* Category grid */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">
                                Category
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {CATEGORIES.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => setCategory(c.id)}
                                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]/50 ${
                                            category === c.id
                                                ? 'bg-[#FFFDD0] text-slate-900 border-[#FFFDD0] shadow-sm shadow-[#FFFDD0]/20'
                                                : 'bg-slate-800/60 text-slate-400 border-white/[0.05] hover:border-white/10 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className="text-lg">{c.icon}</span>
                                        <span>{c.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                                Title
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-800/60 border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-800 transition-colors"
                                placeholder="e.g. Road blocked by fallen tree"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={100}
                            />
                        </div>

                        {/* Details */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                                Details
                            </label>
                            <textarea
                                className="w-full bg-slate-800/60 border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-slate-800 transition-colors h-24 resize-none"
                                placeholder="Any additional helpful details..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={1000}
                            />
                        </div>

                        {/* People & Expiry */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                                    People Affected
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full bg-slate-800/60 border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                    value={peopleAffected}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setPeopleAffected(isNaN(val) ? '' : val);
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                                    Expires In
                                </label>
                                <select
                                    className="w-full bg-slate-800/60 border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                    value={expiryHours}
                                    onChange={(e) => setExpiryHours(parseInt(e.target.value))}
                                >
                                    <option value={1}>1 Hour</option>
                                    <option value={6}>6 Hours</option>
                                    <option value={12}>12 Hours</option>
                                    <option value={24}>24 Hours</option>
                                    <option value={72}>3 Days</option>
                                </select>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="w-full bg-[#FFFDD0] hover:bg-white text-slate-900 font-bold py-3.5 rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-sm shadow-[#FFFDD0]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]/50 text-sm"
                        >
                            Submit Request
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
