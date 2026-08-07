import { Link } from "react-router-dom"



export function Dashboard() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-purple-600 font-semibold mb-2">Maps</p>
                <h1 className="text-3xl font-semibold text-slate-800 mb-10">Chat</h1>
                <div className="space-y-4">
                    <Link to="/map" className="block w-full py-4 rounded-xl font-medium bg-purple-600 text-white shadow-sm transition hover:bg-purple-700 active:scale-[0.99]">
                        Ask for help in Maps
                    </Link>
                    <Link to="/chat" className="block w-full py-4 rounded-xl font-medium bg-white text-slate-800 border border-gray-200 shadow-sm transition hover:border-purple-300 active:scale-[0.99]">
                        Join a quick chat
                    </Link>
                </div>
            </div>
        </div>
    );
}
