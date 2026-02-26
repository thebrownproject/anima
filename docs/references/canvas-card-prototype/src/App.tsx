/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useState, useEffect, WheelEvent } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { Header } from './components/ui/Header';
import { InputBar } from './components/ui/InputBar';
import { DocumentCard } from './components/cards/DocumentCard';
import { TableCard } from './components/cards/TableCard';
import { LongTextCard } from './components/cards/LongTextCard';
import { MetricCard } from './components/cards/MetricCard';
import { AgentCard } from './components/cards/AgentCard';
import { Minus, Plus, RotateCcw } from 'lucide-react';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  // Smooth zoom spring
  const zoomSpring = useSpring(zoom, { stiffness: 300, damping: 30 });

  useEffect(() => {
    zoomSpring.set(zoom);
  }, [zoom, zoomSpring]);

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const newZoom = zoom - e.deltaY * 0.001;
      setZoom(Math.min(Math.max(0.2, newZoom), 3));
    } else {
        // Simple pan on scroll if not zooming
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  return (
    <div 
        ref={containerRef} 
        className="w-full h-screen bg-[#050505] relative overflow-hidden selection:bg-indigo-500/30"
        onWheel={handleWheel}
    >
      {/* Background Grid Pattern - Scales with zoom */}
      <motion.div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none origin-center"
        style={{ 
             scale: zoomSpring,
             x: pan.x,
             y: pan.y,
             backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
        }}
      />

      <Header />
      
      {/* Zoom Controls */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-2 z-50">
        <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="p-3 bg-[#151515] border border-white/10 rounded-full text-white hover:bg-white/10 transition-colors">
            <Plus size={20} />
        </button>
        <button onClick={() => setZoom(1)} className="p-3 bg-[#151515] border border-white/10 rounded-full text-white hover:bg-white/10 transition-colors">
            <RotateCcw size={16} />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-3 bg-[#151515] border border-white/10 rounded-full text-white hover:bg-white/10 transition-colors">
            <Minus size={20} />
        </button>
      </div>

      {/* Canvas Area */}
      <motion.div 
        className="relative w-full h-full origin-center will-change-transform"
        style={{ scale: zoomSpring, x: pan.x, y: pan.y }}
      >
        
        {/* Agent Status */}
        <AgentCard 
          status="idle"
          x={100}
          y={150}
        />

        {/* Financial Report Summary */}
        <DocumentCard 
          title="Q3 Financial Report"
          type="PDF Report"
          date="Oct 12"
          summary="Recurring revenue up 15%. Operating costs stabilized. Key risks: APAC supply chain volatility."
          tags={['Finance', 'Revenue']}
          x={500}
          y={150}
        />

        {/* Metric Cards */}
        <MetricCard 
            title="Total Revenue"
            value="$1.2M"
            trend="15%"
            trendDirection="up"
            color="green"
            x={950}
            y={150}
        />
        
        <MetricCard 
            title="Active Users"
            value="45.2K"
            trend="2.1%"
            trendDirection="down"
            color="orange"
            x={1280}
            y={150}
        />

        {/* Long Text Article */}
        <LongTextCard 
            title="The Future of Document Intelligence"
            subtitle="How AI agents are reshaping the way we interact with information."
            author="Sarah Chen"
            readTime="5 min read"
            content={`In the early days of computing, documents were static artifacts. We printed them, filed them, and occasionally lost them. Then came digitization, which made documents searchable but not truly intelligent.

Today, we stand on the precipice of a new era. AI agents like Anima don't just read documents; they understand them. They can extract structured data from unstructured text, identify anomalies in financial reports, and even synthesize information across thousands of files.

This shift from "document management" to "document intelligence" changes everything. It means that knowledge workers no longer need to spend hours manually entering data into spreadsheets. Instead, they can focus on high-level analysis and decision-making.

Imagine a world where your operating system knows exactly what you're working on. You open a contract, and it automatically highlights the key clauses. You receive an invoice, and it's instantly verified against the purchase order. This isn't science fiction; it's what we're building today.`}
            x={150}
            y={600}
        />

        {/* Data Table */}
        <TableCard 
            title="Q3 Regional Performance"
            headers={['Region', 'Revenue', 'Growth', 'Status']}
            rows={[
                ['North America', '$850,000', '+12%', 'On Track'],
                ['Europe', '$420,000', '+8%', 'Review'],
                ['Asia Pacific', '$310,000', '-2%', 'At Risk'],
                ['Latin America', '$150,000', '+18%', 'Exceeding'],
            ]}
            x={700}
            y={600}
        />

      </motion.div>

      <InputBar />
    </div>
  );
}
