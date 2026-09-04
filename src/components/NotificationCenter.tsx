import React, { useState } from "react";
import { Bell, Briefcase, Users, MessageSquare, AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "../lib/Badge";

export function NotificationCenter({ userRole }: { userRole?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  // Derive notifications based on role for preview/demo
  let notifications = [];
  
  if (userRole === "admin" || userRole === "super_admin" || userRole === "ops_admin" || userRole === "hq" || userRole === "hq_admin") {
     notifications = [
        { id: 1, type: "warning", text: "Delete Request: Candidate Data Erasure Verification", time: "10m ago", icon: AlertTriangle },
        { id: 2, type: "alert", text: "Ownership Dispute: Multiple vendors claimed Priya Sharma", time: "1h ago", icon: ShieldAlert },
        { id: 3, type: "info", text: "Governance Warning: Unapproved budget floated", time: "2h ago", icon: ShieldAlert },
     ];
  } else if (userRole?.includes("client")) {
     notifications = [
        { id: 1, type: "info", text: "New Candidate Submitted for Senior Engineer role", time: "5m ago", icon: Users },
        { id: 2, type: "action", text: "Interview Reminder: Call with Alex in 30m", time: "30m ago", icon: MessageSquare },
     ];
  } else if (userRole?.includes("vendor") || userRole?.includes("recruiter")) {
     notifications = [
        { id: 1, type: "success", text: "Candidate Submitted successfully to Client Apex", time: "2m ago", icon: Users },
        { id: 2, type: "info", text: "Interview Scheduled for Michael Tech", time: "1h ago", icon: MessageSquare },
        { id: 3, type: "warning", text: "Ownership Conflict: Another agency submitted this profile", time: "1d ago", icon: AlertTriangle },
     ];
  } else {
     notifications = [
        { id: 1, type: "info", text: "Welcome to HireNestOS! Check your dashboard for next steps.", time: "Just now", icon: Bell },
     ];
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors relative"
      >
        <Bell size={18} />
        {notifications.length > 0 && (
          <div className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        )}
      </button>

      {isOpen && (
        <>
          <div 
             className="fixed inset-0 z-40" 
             onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 top-12 w-80 bg-white shadow-2xl border border-slate-200 rounded-3xl z-50 overflow-hidden min-h-[300px] flex flex-col animate-in slide-in-from-top-2 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
                 <Bell size={14} className="text-indigo-600" /> Notifications
               </h3>
               <Badge className="bg-indigo-100 text-indigo-700 text-[9px]">{notifications.length} New</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[400px]">
               {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                     <Bell size={24} className="mx-auto mb-2 opacity-20" />
                     <p className="text-xs font-medium">All caught up!</p>
                  </div>
               ) : (
                  <div className="divide-y divide-slate-50">
                     {notifications.map((n) => {
                        const Icon = n.icon;
                        return (
                           <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer">
                              <div className={`mt-0.5 shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                                 n.type === 'alert' ? 'bg-rose-100 text-rose-600' :
                                 n.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                 n.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                 'bg-indigo-100 text-indigo-600'
                              }`}>
                                 <Icon size={14} />
                              </div>
                              <div>
                                 <p className="text-xs font-semibold text-slate-800 leading-snug">{n.text}</p>
                                 <p className="text-[10px] text-slate-400 font-mono mt-1">{n.time}</p>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
            
            <div className="p-3 border-t border-slate-100 text-center bg-slate-50/50">
               <button className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest hover:underline">
                  Mark all as read
               </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
