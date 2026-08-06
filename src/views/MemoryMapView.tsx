import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Building2, Users, Shield, Network, LayoutGrid, Info, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function MemoryMapView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!svgRef.current || !containerRef.current) return;
      setLoading(true);

      try {
        const snap = await getDocs(query(collection(db, "organizations"), limit(25)));
        const orgs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any);

        const data: any = {
          name: "Global HQ",
          type: "admin",
          children: [
            {
              name: "Demand Tier",
              type: "category",
              children: orgs.filter(o => o.type === 'client').map(o => ({ name: o.companyName || o.id, type: 'client', value: 1, ...o }))
            },
            {
              name: "Supply Tier",
              type: "category",
              children: [
                { 
                  name: "Vendors", 
                  type: "category", 
                  children: orgs.filter(o => o.type === 'vendor').map(o => ({ name: o.companyName || o.id, type: 'vendor', value: 1, ...o }))
                },
                { 
                  name: "Recruiters", 
                  type: "category", 
                  children: orgs.filter(o => o.type === 'recruiter').map(o => ({ name: o.companyName || o.id, type: 'recruiter', value: 1, ...o }))
                },
                { 
                  name: "Independents", 
                  type: "category", 
                  children: orgs.filter(o => o.type === 'independent').map(o => ({ name: o.companyName || o.id, type: 'independent', value: 1, ...o }))
                }
              ]
            }
          ]
        };

        renderChart(data);
      } catch (err: any) {
        console.warn("Relationship Intelligence Data Load Failed:", err.message);
      } finally {
        setLoading(false);
      }
    }

    function renderChart(data: any) {
      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      const svg = d3.select(svgRef.current!)
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

      svg.selectAll("*").remove();

      const root = d3.hierarchy(data);
      const tree = d3.tree().size([2 * Math.PI, Math.min(width, height) / 2 - 120]);
      tree(root);

      const link = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#E2E8F0")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.5)
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("d", d3.linkRadial()
          .angle((d: any) => d.x)
          .radius((d: any) => d.y) as any);

      const node = svg.append("g")
        .selectAll("g")
        .data(root.descendants())
        .join("g")
        .attr("transform", (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
        .on("click", (event, d) => {
          setSelectedNode(d.data);
        })
        .attr("class", "cursor-pointer group");

      node.append("circle")
        .attr("fill", (d: any) => {
          if (d.data.type === 'admin') return "#4F46E5";
          if (d.data.type === 'category') return "#1e293b";
          if (d.data.type === 'client') return "#6366f1";
          if (d.data.type === 'vendor') return "#f59e0b";
          if (d.data.type === 'independent') return "#10b981";
          return "#94a3b8";
        })
        .attr("r", (d: any) => d.data.type === 'admin' ? 8 : (d.data.type === 'category' ? 5 : 3.5))
        .attr("class", "transition-all group-hover:r-6");

      node.append("text")
        .attr("dy", "0.31em")
        .attr("x", (d: any) => d.x < Math.PI ? 10 : -10)
        .attr("text-anchor", (d: any) => d.x < Math.PI ? "start" : "end")
        .attr("transform", (d: any) => d.x >= Math.PI ? "rotate(180)" : null)
        .attr("class", "text-[9px] font-black uppercase tracking-widest fill-slate-900 group-hover:fill-indigo-600 transition-colors")
        .text((d: any) => d.data.name);
    }

    loadData();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden p-8" ref={containerRef}>
      <div className="flex justify-between items-start mb-8 z-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter lowercase italic">identity relationship intelligence</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Hierarchical visualization of active network nodes.</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-6">
              {[
                { label: 'Governance', color: 'bg-slate-900' },
                { label: 'Demand', color: 'bg-indigo-600' },
                { label: 'Supply', color: 'bg-amber-500' },
                { label: 'Independent', color: 'bg-emerald-500' }
              ].map(tag => (
                <div key={tag.label} className="flex items-center gap-2">
                  <div className={cn("h-3 w-3 rounded-full", tag.color)} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tag.label}</span>
                </div>
              ))}
           </div>
           <button className="bg-slate-900 text-white rounded-2xl p-4 hover:scale-105 transition-transform shadow-xl shadow-slate-200">
              <LayoutGrid size={20} />
           </button>
        </div>
      </div>

      <div className="flex-1 relative border-4 border-slate-50 rounded-[48px] bg-slate-50/30 overflow-hidden cursor-move">
        <svg ref={svgRef} className="w-full h-full" />
        
        {selectedNode && (
          <div className="absolute top-8 right-8 w-72 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between mb-4">
              <Badge className="bg-indigo-600 text-white uppercase text-[8px] tracking-widest">{selectedNode.type}</Badge>
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-900"
              >
                ×
              </button>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight lowercase mb-2">{selectedNode.name}</h3>
            <p className="text-[10px] text-slate-500 uppercase font-bold leading-relaxed mb-6">
              Authenticated node in the HierNestOS global execution graph.
            </p>
            <div className="space-y-3">
               <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Authority</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase">Tier 1</span>
               </div>
               <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Connected</span>
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                    <Activity size={10} /> Live sync
                  </span>
               </div>
            </div>
            <button className="w-full mt-6 bg-slate-900 text-white h-12 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors">
              Manage Node Identity
            </button>
          </div>
        )}

        <div className="absolute bottom-8 left-8 flex items-center gap-4 bg-white/80 backdrop-blur px-6 py-4 rounded-2xl border border-slate-100 shadow-xl">
           <Info size={16} className="text-indigo-600" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Scroll to zoom • Drag to pan • Click node for metadata</p>
        </div>
      </div>
    </div>
  );
}

function Badge({ className, children }: { className?: string, children: React.ReactNode }) {
  return (
    <span className={cn("px-2 py-0.5 rounded font-black tracking-widest", className)}>
      {children}
    </span>
  );
}
