import { Search, Command, Mic } from 'lucide-react';

export function InputBar() {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full opacity-30 group-hover:opacity-70 blur transition duration-500"></div>
        <div className="relative flex items-center bg-[#151515] border border-white/10 rounded-full px-4 py-3 shadow-2xl">
            <Search className="text-neutral-500 ml-2" size={20} />
            <input 
                type="text" 
                placeholder="Ask anything or paste a document..." 
                className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder:text-neutral-600 font-medium"
            />
            <div className="flex items-center gap-2 pr-2">
                <button className="p-2 hover:bg-white/10 rounded-full text-neutral-400 transition-colors">
                    <Mic size={18} />
                </button>
                <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
                <div className="flex items-center gap-1 text-xs font-mono text-neutral-500 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    <Command size={10} />
                    <span>K</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
