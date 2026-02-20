import { BaseCard } from './BaseCard';
import { ArrowUpRight } from 'lucide-react';

interface CardCommonProps {
  x: number;
  y: number;
  id?: string;
  isSelected?: boolean;
  onSelect?: () => void;
}

interface DataCardProps extends CardCommonProps {
  title: string;
  data: Record<string, string | number>[];
}

export function DataCard({ title, data, x, y, id, isSelected, onSelect }: DataCardProps) {
  const headers = Object.keys(data[0] || {});

  return (
    <BaseCard 
      x={x} 
      y={y} 
      id={id}
      isSelected={isSelected}
      onSelect={onSelect}
      color="yellow" 
      width="w-[400px]"
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-bold">{title}</h2>
            <button className="p-1 hover:bg-black/5 rounded-full transition-colors">
                <ArrowUpRight size={16} className="opacity-50" />
            </button>
        </div>
        
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white/50">
          <table className="w-full text-sm text-left">
            <thead className="bg-black/5 text-xs uppercase font-semibold">
              <tr>
                {headers.map(header => (
                  <th key={header} className="px-3 py-2 opacity-70">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-black/5 transition-colors">
                  {headers.map(header => (
                    <td key={header} className="px-3 py-2 font-mono text-xs">{row[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 mt-4">
            <button className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg shadow-sm hover:bg-neutral-800 transition-colors">
                Export CSV
            </button>
            <button className="px-3 py-1.5 bg-white border border-black/10 text-xs font-medium rounded-lg shadow-sm hover:bg-neutral-50 transition-colors">
                Edit Data
            </button>
        </div>
      </div>
    </BaseCard>
  );
}
