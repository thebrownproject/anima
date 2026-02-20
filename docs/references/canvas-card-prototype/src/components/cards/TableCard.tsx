import { BaseCard } from './BaseCard';
import { ArrowUpRight } from 'lucide-react';

interface CardCommonProps {
  x: number;
  y: number;
  id?: string;
  isSelected?: boolean;
  onSelect?: () => void;
}

interface TableCardProps extends CardCommonProps {
  title: string;
  headers: string[];
  rows: string[][];
}

export function TableCard({ title, headers, rows, x, y, id, isSelected, onSelect }: TableCardProps) {
  return (
    <BaseCard 
      x={x} 
      y={y} 
      id={id}
      isSelected={isSelected}
      onSelect={onSelect}
      color="dark" 
      width="w-[600px]"
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <ArrowUpRight size={18} />
            </button>
        </div>

        <div className="w-full overflow-hidden">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-white/10">
                        {headers.map((h, i) => (
                            <th key={i} className="py-3 px-2 text-xs font-mono uppercase opacity-50 tracking-wider">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="group hover:bg-white/5 transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className="py-4 px-2 text-sm border-b border-white/5 font-medium group-last:border-none">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        <div className="mt-6 flex justify-between items-center text-xs opacity-40 font-mono">
            <span>{rows.length} entries</span>
            <span>Synced just now</span>
        </div>
      </div>
    </BaseCard>
  );
}
