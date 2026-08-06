import React, { useEffect, useState, useRef } from 'react';
import { Shield, Activity, Terminal, Lock, Zap, Server } from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

  interface TraceEvent {
    id: string;
    timestamp: string;
    origin: string;
    action: string;
    status: 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'INFO' | 'FAILED';
    payload: string;
    traceId?: string;
  }

  export default function TraceView() {
    const [events, setEvents] = useState<TraceEvent[]>([]);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const q = query(
        collection(db, "execution_events"),
        orderBy("timestamp", "desc"),
        limit(50)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newEvents: TraceEvent[] = snapshot.docs.map(doc => {
          const data = doc.data();
          const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '---';
          
          let statusStr: any = data.metadata?.severity || 'INFO';
          if (data.eventType?.includes("BREACH") || data.eventType?.includes("LEAKAGE")) statusStr = 'CRITICAL';
          if (data.eventType?.includes("CLOSED") || data.eventType?.includes("REALIZED")) statusStr = 'SUCCESS';

          return {
            id: doc.id,
            timestamp: time,
            origin: data.actorType || data.workerId || 'SYSTEM',
            action: data.eventType || data.action || 'Generic execution event',
            status: statusStr,
            payload: data.targetId || data.vendorId || 'global_sys',
            traceId: data.traceId || doc.id
          };
        }).reverse();
        setEvents(newEvents);
      });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-[#00FF41] font-mono p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 border-b border-[#1A1A1A] pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-[0.2em] text-white">Activity Feed <span className="text-indigo-500 italic">v4.2</span></h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Live Audit Stream • hirenest-os-core</p>
          </div>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'Uptime', value: '99.99%', icon: Server },
            { label: 'Latency', value: '14ms', icon: Zap },
            { label: 'Encryption', value: 'm-aes-256', icon: Lock }
          ].map(stat => (
            <div key={stat.label} className="bg-[#141414] border border-[#222] px-4 py-2 rounded-xl flex items-center gap-3">
              <stat.icon size={12} className="text-indigo-500" />
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 uppercase tracking-widest leading-none mb-1">{stat.label}</span>
                <span className="text-xs text-white font-black leading-none">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#050505] border border-[#1A1A1A] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <div className="bg-[#111] px-4 py-2 border-b border-[#1A1A1A] flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20" />
          </div>
          <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black ml-2 flex items-center gap-2">
            <Terminal size={10} />
            Governance_Audit_Log --tail
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-2 text-[11px] leading-relaxed selection:bg-indigo-500/30">
          {events.map((event, i) => (
            <div key={event.id} className={cn(
              "flex gap-4 group transition-colors hover:bg-white/5 p-1 rounded",
              event.status === 'WARNING' ? 'text-amber-400' : 
              event.status === 'CRITICAL' ? 'text-red-500' : ''
            )}>
              <span className="text-slate-600 shrink-0">[{event.timestamp}]</span>
              <span className="text-indigo-500 font-black shrink-0 w-32">[{event.origin}]</span>
              <span className="flex-1">
                {event.action}
                {event.traceId && <span className="ml-3 text-[9px] text-slate-700 bg-slate-800/50 px-1 py-0.5 rounded font-mono">TRC: {event.traceId}</span>}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-slate-600 font-mono italic opacity-0 group-hover:opacity-100 transition-opacity">ORG: {event.payload}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-black tracking-widest",
                  event.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' :
                  event.status === 'INFO' ? 'bg-indigo-500/10 text-indigo-500' :
                  event.status === 'WARNING' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                )}>
                  {event.status}
                </span>
              </div>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-[10px] text-slate-600 uppercase tracking-widest font-black">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Real-time synchronization enabled
          </span>
          <span className="flex items-center gap-2">
            <Shield size={12} className="text-indigo-500" />
            PWP Protocol Active
          </span>
        </div>
        <div className="flex gap-4">
          <span className="hover:text-white cursor-pointer transition-colors">Clear Buffer</span>
          <span className="hover:text-white cursor-pointer transition-colors">Export Logs (JSON)</span>
        </div>
      </div>
    </div>
  );
}
