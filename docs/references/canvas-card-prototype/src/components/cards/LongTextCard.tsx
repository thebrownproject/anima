import { BaseCard } from './BaseCard';

interface CardCommonProps {
  x: number;
  y: number;
  id?: string;
  isSelected?: boolean;
  onSelect?: () => void;
}

interface LongTextCardProps extends CardCommonProps {
  title: string;
  subtitle?: string;
  content: string;
  author?: string;
  readTime?: string;
}

export function LongTextCard({ title, subtitle, content, author, readTime, x, y, id, isSelected, onSelect }: LongTextCardProps) {
  return (
    <BaseCard 
      x={x} 
      y={y} 
      id={id}
      isSelected={isSelected}
      onSelect={onSelect}
      color="white" 
      width="w-[500px]"
      height="h-[600px]"
    >
      <div className="flex flex-col h-full">
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
             <span className="px-3 py-1 rounded-full border border-black/10 text-xs font-medium uppercase tracking-wider">
               Article
             </span>
             {readTime && <span className="text-xs font-mono opacity-50">{readTime}</span>}
          </div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight mb-2">{title}</h1>
          {subtitle && <p className="text-lg opacity-60 leading-snug">{subtitle}</p>}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide mask-fade-bottom">
          <div className="prose prose-lg prose-neutral leading-relaxed opacity-90 whitespace-pre-wrap font-serif">
            {content}
          </div>
        </div>

        {author && (
            <div className="mt-6 pt-6 border-t border-black/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black/10"></div>
                <span className="text-sm font-medium">{author}</span>
            </div>
        )}
      </div>
    </BaseCard>
  );
}
