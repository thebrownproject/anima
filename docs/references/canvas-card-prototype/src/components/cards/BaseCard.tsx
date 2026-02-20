import { motion } from 'motion/react';
import { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

interface BaseCardProps {
  children: ReactNode;
  className?: string;
  x?: number;
  y?: number;
  width?: string;
  height?: string;
  color?: 'yellow' | 'pink' | 'green' | 'blue' | 'white' | 'dark' | 'orange' | 'purple' | 'cream';
}

export function BaseCard({ 
  children, 
  className, 
  x = 0, 
  y = 0, 
  width = 'w-80',
  height = 'h-auto',
  color = 'white'
}: BaseCardProps) {
  
  const colorStyles = {
    yellow: 'bg-[#F2E8CF] text-[#2C2C2C]',
    pink: 'bg-[#FFD6E0] text-[#2C2C2C]',
    green: 'bg-[#D8F3DC] text-[#1B4332]',
    blue: 'bg-[#D7E3FC] text-[#1D3557]',
    white: 'bg-[#F8F9FA] text-[#212529]',
    cream: 'bg-[#F2E9E4] text-[#22223B]',
    dark: 'bg-[#121212] text-[#E0E0E0] border border-white/10',
    orange: 'bg-[#FFD8BE] text-[#4A2C18]',
    purple: 'bg-[#E2C6FF] text-[#2E1A47]',
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ x, y, opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "absolute rounded-[40px] shadow-2xl flex flex-col cursor-grab active:cursor-grabbing overflow-hidden border",
        colorStyles[color],
        width,
        height,
        className
      )}
      style={{ x, y }}
    >
      <div className="p-8 flex-1 flex flex-col h-full relative">
        {children}
      </div>
    </motion.div>
  );
}
