import { BaseCard } from './BaseCard';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down';
  color?: 'green' | 'pink' | 'blue' | 'orange' | 'yellow';
  x: number;
  y: number;
}

export function MetricCard({ title, value, trend, trendDirection, color = 'green', x, y }: MetricCardProps) {
  // Mock data for the bar chart
  const bars = [40, 65, 45, 80, 55, 90, 70];

  return (
    <BaseCard 
      x={x} 
      y={y} 
      color={color} 
      width="w-[300px]"
      height="h-[340px]"
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex justify-between items-start">
            <span className="px-3 py-1 rounded-full border border-black/10 text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm">
                {title}
            </span>
            <button className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                <ArrowRight size={14} />
            </button>
        </div>

        <div className="mt-4">
            <h3 className="text-6xl font-bold tracking-tighter leading-none mb-2">{value}</h3>
            <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-md ${trendDirection === 'up' ? 'bg-black/5' : 'bg-black/5'}`}>
                    {trendDirection === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {trend}
                </span>
                <span className="text-xs opacity-60 font-medium">vs last month</span>
            </div>
        </div>

        <div className="mt-auto pt-6 flex items-end gap-2 h-24">
            {bars.map((height, i) => (
                <div key={i} className="flex-1 bg-black/10 rounded-t-sm relative group overflow-hidden" style={{ height: `${height}%` }}>
                    <div className="absolute inset-0 bg-black/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </div>
            ))}
        </div>
      </div>
    </BaseCard>
  );
}
