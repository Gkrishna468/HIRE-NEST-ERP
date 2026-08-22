import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Star,
  FileText,
  CheckCircle2,
  DollarSign,
  Activity,
  TrendingUp,
  Award,
} from "lucide-react";
import { cn } from "../lib/utils";
import { db } from "../lib/firebase";
import { collection, query, getDocs, where, limit } from "firebase/firestore";

export default function RecruiterPerformanceTab({
  userRole,
}: {
  userRole: string;
}) {
  const [loading, setLoading] = useState(true);
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);

  const isAdmin = ["admin", "super_admin", "hq_admin", "ops_admin"].includes(
    userRole,
  );

  useEffect(() => {
    let active = true;
    const fetchRecruitersAndPerformance = async () => {
      try {
        // 1. Fetch Recruiters
        const usersSnap = await getDocs(
          query(
            collection(db, "users"),
            where("role", "in", ["recruiter", "hq_admin", "admin"]),
            limit(50)
          ),
        );
        const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 2. Fetch Opportunities
        const oppsSnap = await getDocs(query(collection(db, "match_opportunities"), limit(25)));
        const opps = oppsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

        // 3. Fetch Submissions
        const subsSnap = await getDocs(query(collection(db, "submissions"), limit(25)));
        const subs = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

        // 4. Fetch DealRooms (Placements)
        const dealSnap = await getDocs(query(collection(db, "dealRooms"), limit(25)));
        const deals = dealSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

        if (!active) return;

        const perfMap: Record<string, any> = {};
        users.forEach((u) => {
          perfMap[u.id] = {
            recruiter: u,
            matchesReviewed: 0, // Approx mapping
            submissions: 0,
            interviews: 0,
            placements: 0,
            revenueClosed: 0,
            score: 0,
          };
        });

        // Correlate Data - very naive approach based on random distribution or explicit ownership
        // Assuming recruiter owns the requirement in the opp or deal. If no owner, attach to random for demo, or match by id if owner exists.

        subs.forEach((s: any) => {
          // Try to attach by owner or creator
          const ownerId = s.submittedBy || s.owner || users[0]?.id; // Default to first user if missing
          if (perfMap[ownerId]) {
            perfMap[ownerId].submissions++;
            if (s.status === "INTERVIEWING") perfMap[ownerId].interviews++;
            if (s.status === "HIRED" || s.status === "SELECTED") {
              perfMap[ownerId].placements++;
              perfMap[ownerId].revenueClosed += 25000;
            }
          }
        });

        deals.forEach((d) => {
          const ownerId = d.ownerId || users[0]?.id;
          if (perfMap[ownerId]) {
            if (d.currentStage === "Interview" || d.currentStage === "Offer")
              perfMap[ownerId].interviews++;
            if (d.currentStage === "Hired" || d.status === "WON") {
              perfMap[ownerId].placements++;
              perfMap[ownerId].revenueClosed += 25000;
            }
          }
        });

        opps.forEach((o) => {
          const ownerId = o.owner || users[0]?.id;
          if (perfMap[ownerId]) {
            perfMap[ownerId].matchesReviewed++;
          }
        });

        // Calculate score
        const perfArray = Object.values(perfMap)
          .map((p) => {
            const score =
              p.submissions * 2 + p.interviews * 5 + p.placements * 20;
            return { ...p, score };
          })
          .filter((p) => p.score > 0 || p.matchesReviewed > 0)
          .sort((a, b) => b.score - a.score);

        setRecruiters(users);
        setPerformanceData(perfArray);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchRecruitersAndPerformance();
    return () => {
      active = false;
    };
  }, []);

  if (!isAdmin && userRole !== "hq") {
    return (
      <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
        Access Restricted to HQ
      </div>
    );
  }

  const formatCurrency = (val: number) => "₹" + val.toLocaleString("en-IN");

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Award className="text-amber-500" size={28} />
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                Recruiter Engine
              </h1>
            </div>
            <p className="text-slate-500 font-medium text-sm">
              Performance leaderboards and pipeline momentum.
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-[1400px] mx-auto w-full">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-slate-200 rounded-2xl w-full"></div>
            <div className="h-64 bg-slate-200 rounded-2xl w-full"></div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Top Performers Cards */}
              {performanceData.slice(0, 3).map((perf, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "rounded-2xl p-6 border relative overflow-hidden",
                    idx === 0
                      ? "bg-amber-50 border-amber-200"
                      : "bg-white border-slate-200",
                  )}
                >
                  {idx === 0 && (
                    <Star
                      className="absolute -right-4 -top-4 text-amber-500/10"
                      size={120}
                    />
                  )}
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shadow-sm"
                      style={{
                        backgroundColor: idx === 0 ? "#fbbf24" : "#f1f5f9",
                        color: idx === 0 ? "#fff" : "#475569",
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Score
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-black",
                          idx === 0 ? "text-amber-600" : "text-slate-700",
                        )}
                      >
                        {perf.score}
                      </p>
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-slate-900">
                      {perf.recruiter.name ||
                        perf.recruiter.email ||
                        "System User"}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500">
                      {perf.placements} Placements
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Performance Leaderboard
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white">
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase">
                        Rank
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase">
                        Recruiter Name
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase text-center">
                        Reqs Worked
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase text-center">
                        Submissions
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase text-center">
                        Interviews
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-emerald-500 bg-emerald-50 text-center">
                        Placements
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase text-center">
                        Intv Conv
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-slate-400 uppercase text-center">
                        Plc Conv
                      </th>
                      <th className="px-6 py-4 text-xs font-black tracking-widest text-indigo-500 uppercase text-right">
                        Rev Closed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {performanceData.map((perf, idx) => {
                      const intvConv = perf.submissions > 0 ? ((perf.interviews / perf.submissions) * 100).toFixed(0) : 0;
                      const plcConv = perf.interviews > 0 ? ((perf.placements / perf.interviews) * 100).toFixed(0) : 0;
                      
                      return (
                      <tr
                        key={perf.recruiter.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900">
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">
                            {perf.recruiter.name || perf.recruiter.email}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Score: {perf.score}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-slate-600">
                          {perf.matchesReviewed}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-slate-600">
                          {perf.submissions}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-blue-600">
                          {perf.interviews}
                        </td>
                        <td className="px-6 py-4 text-center font-black text-emerald-600 bg-emerald-50/50">
                          {perf.placements}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-slate-600">
                          {intvConv}%
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-slate-600">
                          {plcConv}%
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(perf.revenueClosed)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
