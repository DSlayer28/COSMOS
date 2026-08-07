import { Link } from "react-router-dom";

export function Dashboard() {
    return (
        <div className="min-h-svh bg-slate-950 flex items-center justify-center px-5 sm:px-6 py-10">
            {/* Subtle radial glow behind the card */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[600px] h-[340px] sm:h-[600px] bg-[#FFFDD0]/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-sm sm:max-w-md text-center">
              

                <p className="text-[40px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-white-400 font-bold mb-2 sm:mb-3">
                    Disaster Response Platform
                </p>

                <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2 sm:mb-3 tracking-tight">
                    COSMOS
                </h1>

                <p className="text-slate-400 text-xs sm:text-sm mb-10 sm:mb-12 max-w-[280px] sm:max-w-xs mx-auto leading-relaxed">
                    Connect with others on your local network. Share your location or chat for help.
                </p>

                <div className="space-y-3 sm:space-y-4">
                    {/* Map Button */}
                    <Link
                        to="/map"
                        className="group block w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl font-semibold bg-white/[0.04] text-white border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-white-500/50 hover:text-white hover:scale-[1.02] active:scale-[0.98]"
                    >
                       
                        <div className="relative flex items-center justify-center gap-2.5 sm:gap-3">
                            
                            <span className="text-sm sm:text-base text-white">Open Map</span>
                        </div>
                    </Link>

                    {/* Chat Button */}
                    <Link
                        to="/chat"
                        className="group block w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl font-semibold bg-white/[0.04] text-white border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-white-500/50 hover:text-white hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <div className="flex items-center justify-center gap-2.5 sm:gap-3">
                            
                            <span className="text-sm sm:text-base text-white">Join Chat Room</span>
                        </div>
                    </Link>
                </div>

                {/* Footer hint */}
                <p className="text-slate-600 text-[10px] sm:text-xs mt-8 sm:mt-10">
                    Works offline — no internet required
                </p>
            </div>
        </div>
    );
}