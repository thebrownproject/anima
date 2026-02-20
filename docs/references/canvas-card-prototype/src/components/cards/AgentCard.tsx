import { BaseCard } from './BaseCard';
import { Bot, Sparkles, Activity, Cpu, Zap } from 'lucide-react';

interface AgentCardProps {
  status: 'idle' | 'processing' | 'learning';
  x: number;
  y: number;
}

export function AgentCard({ status, x, y }: AgentCardProps) {
  return (
    <BaseCard 
      x={x} 
      y={y} 
      color="dark" 
      width="w-[340px]"
      className="backdrop-blur-xl bg-[#121212]/90 border-white/10"
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    <Bot className="text-white relative z-10" size={28} />
                </div>
                <div>
                    <h2 className="font-bold text-xl tracking-tight">Sprite Agent</h2>
                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        {status === 'idle' ? 'System Online' : 'Processing...'}
                    </div>
                </div>
            </div>
            <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                <Zap size={18} className="text-yellow-400" />
            </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <Activity size={20} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-2xl font-bold font-mono">98%</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Efficiency</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <Cpu size={20} className="text-pink-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-2xl font-bold font-mono">1.2GB</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Memory</div>
            </div>
        </div>

        <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-neutral-500">
                <span>Context Window</span>
                <span>65%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-[65%] rounded-full relative">
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                </div>
            </div>
        </div>
      </div>
    </BaseCard>
  );
}
