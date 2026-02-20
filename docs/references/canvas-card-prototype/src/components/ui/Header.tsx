import { LayoutGrid, Plus, Bell, User, Settings } from 'lucide-react';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 p-6 z-50 flex justify-between items-start pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto">
        <button className="p-3 bg-[#151515] border border-white/10 rounded-full text-white hover:bg-white/10 transition-colors">
            <LayoutGrid size={20} />
        </button>
        <div className="flex items-center bg-[#151515] border border-white/10 rounded-full p-1">
            <button className="px-4 py-2 bg-white/10 rounded-full text-sm font-medium text-white shadow-sm">My Stack</button>
            <button className="px-4 py-2 text-sm font-medium text-neutral-500 hover:text-white transition-colors">Archive</button>
            <button className="px-4 py-2 text-sm font-medium text-neutral-500 hover:text-white transition-colors">Shared</button>
        </div>
      </div>

      <div className="flex items-center gap-3 pointer-events-auto">
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium text-sm shadow-lg shadow-indigo-500/20 transition-colors">
            <Plus size={16} />
            <span>New Stack</span>
        </button>
        <button className="p-3 bg-[#151515] border border-white/10 rounded-full text-neutral-400 hover:text-white transition-colors">
            <Bell size={20} />
        </button>
        <button className="p-3 bg-[#151515] border border-white/10 rounded-full text-neutral-400 hover:text-white transition-colors">
            <User size={20} />
        </button>
      </div>
    </header>
  );
}
