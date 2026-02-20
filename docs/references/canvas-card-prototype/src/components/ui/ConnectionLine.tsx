import { motion } from 'motion/react';

interface ConnectionLineProps {
  start: { x: number; y: number; w: number; h: number };
  end: { x: number; y: number; w: number; h: number };
  color?: string;
}

export function ConnectionLine({ start, end, color = '#6366f1' }: ConnectionLineProps) {
  // Calculate center points
  const startX = start.x + start.w / 2;
  const startY = start.y + start.h / 2;
  const endX = end.x + end.w / 2;
  const endY = end.y + end.h / 2;

  // Control points for a smooth curve
  const midX = (startX + endX) / 2;
  const controlPoint1 = { x: midX, y: startY };
  const controlPoint2 = { x: midX, y: endY };

  const path = `M ${startX} ${startY} C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${endX} ${endY}`;

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeOpacity="0.2"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
      <motion.circle 
        cx={startX} 
        cy={startY} 
        r="3" 
        fill={color} 
        fillOpacity="0.5"
      />
      <motion.circle 
        cx={endX} 
        cy={endY} 
        r="3" 
        fill={color} 
        fillOpacity="0.5"
      />
      {/* Animated particle flowing along the line */}
      <circle r="3" fill={color}>
        <animateMotion 
            dur="3s" 
            repeatCount="indefinite" 
            path={path}
            keyPoints="0;1"
            keyTimes="0;1"
        />
      </circle>
    </svg>
  );
}
