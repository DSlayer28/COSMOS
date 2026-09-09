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

const CATEGORIES: { id: RequestCategory, label: string }[] = [
    { id: 'medical', label: 'Medical Emergency' },
    { id: 'rescue', label: 'Search & Rescue' },
    { id: 'medicine', label: 'Medicine Needed' },
    { id: 'water', label: 'Water Needed' },
    { id: 'food', label: 'Food Needed' },
    { id: 'shelter', label: 'Shelter Needed' },
    { id: 'sanitation', label: 'Sanitation' },
    { id: 'transport', label: 'Transport Needed' },
    { id: 'information', label: 'Information Request' },
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
        if (!category) {
            setError('Please select a category.');
            return;
        }
        if (!title.trim() || !description.trim()) {
            setError('Title and description are required.');
            return;
        }

        socket.emit('create-request', {
            category,
            title,
            description,
            peopleAffected: Number(peopleAffected) || 1,
            lat,
            lng,
            expiresAt: Date.now() + (expiryHours * 60 * 60 * 1000)
        });
        
        // Reset and close
        setCategory(null);
        setTitle('');
        setDescription('');
        setPeopleAffected(1);
        setExpiryHours(24);
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Create Request</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
                </div>
                
                {error && <div className="text-red-400 text-sm mb-4 bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                        <div className="grid grid-cols-3 gap-2">
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setCategory(c.id)}
                                    className={`p-2 text-xs rounded-lg border transition-all ${category === c.id ? 'bg-[#FFFDD0] text-slate-900 border-[#FFFDD0]' : 'bg-slate-800 text-slate-300 border-white/5 hover:border-white/20'}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#FFFDD0]/50"
                            placeholder="e.g., Road blocked by fallen tree"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={100}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Details</label>
                        <textarea 
                            className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#FFFDD0]/50 h-24 resize-none"
                            placeholder="Provide any additional helpful details..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={1000}
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-300 mb-1">People Affected</label>
                            <input 
                                type="number" 
                                min="1"
                                className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#FFFDD0]/50"
                                value={peopleAffected}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setPeopleAffected(isNaN(val) ? '' : val);
                                }}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Expires In</label>
                            <select 
                                className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#FFFDD0]/50"
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
                    
                    <button 
                        type="submit" 
                        className="w-full bg-[#FFFDD0] text-slate-900 font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
                    >
                        Submit Request
                    </button>
                </form>
            </div>
        </div>
    );
}
