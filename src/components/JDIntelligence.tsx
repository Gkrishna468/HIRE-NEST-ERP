import React from "react";
import { Badge } from "../lib/Badge";
import {
  Clock,
  MapPin,
  ListChecks,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
  Quote,
  Banknote,
  Cpu,
  TrendingUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { formatBudget } from "../lib/currency";

interface JDIntelligenceProps {
  job: any;
}

export const JDIntelligence: React.FC<JDIntelligenceProps> = ({ job }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <FileText size={200} />
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-500 hover:bg-indigo-600 text-white border-none text-[10px] uppercase font-black tracking-widest px-3 py-1">
                  {job.status}
                </Badge>
                <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest font-bold">
                  Ref: {job.id.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight leading-tight uppercase">
                {job.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 mt-8">
            {formatBudget(job.budget || job.clientTargetBudget, "") && (
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
                <Banknote className="text-indigo-400" size={18} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                    Budget
                  </p>
                  <p className="text-sm font-bold">
                    {formatBudget(job.budget || job.clientTargetBudget)}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
              <Clock className="text-indigo-400" size={18} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Experience
                </p>
                <p className="text-sm font-bold">
                  {job.experience || `${job.minExp}+ YRS`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
              <MapPin className="text-indigo-400" size={18} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Location
                </p>
                <p className="text-sm font-bold">{job.location || "Remote"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
              <ListChecks className="text-indigo-400" size={18} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Priority Skills
                </p>
                <p className="text-sm font-bold">
                  {(job.mandatorySkills || []).length} Mandatory
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recruiter Copilot AI Insights */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Sparkles size={120} className="text-indigo-600" />
        </div>
        <div className="relative z-10">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                 <Cpu size={16} className="text-indigo-500" /> Neural Requirement Intelligence
              </h3>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Demand:</span>
                    <Badge className={cn(
                      "border-none text-[10px] uppercase font-black px-2 py-0.5",
                      job.insights?.demand === "HIGH" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {job.insights?.demand || "HIGH"}
                    </Badge>
                 </div>
                 <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Risk:</span>
                    <span className="text-[10px] font-black text-slate-700 uppercase">{job.insights?.riskLevel || "LOW"}</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Health Score Gauge */}
              <div className="lg:col-span-1 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-[24px] border border-slate-100">
                 <div className="relative h-24 w-24 flex items-center justify-center mb-4">
                    <svg className="h-full w-full transform -rotate-90">
                       <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-slate-200"
                       />
                       <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2 - (251.2 * (job.insights?.healthScore || 94)) / 100}
                          className="text-indigo-500 transition-all duration-1000"
                       />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <span className="text-2xl font-black text-slate-900 leading-none">{job.insights?.healthScore || 94}%</span>
                    </div>
                 </div>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Requirement Health</p>
              </div>

              <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-3 gap-4">
                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Matching Candidates</div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-2xl font-black text-slate-900">{job.insights?.internalMatches ?? job.internalMatches ?? "28"}</div>
                       <span className="text-[10px] font-bold text-emerald-500">+4 new</span>
                    </div>
                    <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 w-[65%]" />
                    </div>
                 </div>

                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Ready Now</div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-2xl font-black text-indigo-600">{job.insights?.readyNow || "7"}</div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Bench</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-3 italic leading-tight">Pre-cleared and available for immediate interview.</p>
                 </div>

                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Vendor Coverage</div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-2xl font-black text-slate-900">{job.insights?.vendorCoverage || "12"}</div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Agencies</span>
                    </div>
                    <div className="flex -space-x-2 mt-4">
                       {[1,2,3,4].map(i => (
                          <div key={i} className="h-6 w-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">V{i}</div>
                       ))}
                       <div className="h-6 w-6 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center text-[8px] font-bold text-indigo-600">+8</div>
                    </div>
                 </div>

                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">Estimated Fill</div>
                    <div className="flex items-baseline gap-2">
                       <div className="text-2xl font-black text-slate-900">{job.insights?.estimatedFill || "5"}</div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Days</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 font-bold mt-3 flex items-center gap-1">
                       <TrendingUp size={10} /> 2 days faster than avg
                    </p>
                 </div>

                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-colors col-span-2">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">AI Strategic Advice</div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                       "Focus on candidates from <span className="text-indigo-600 font-bold">Worknexa</span> bench. Their recent placements for similar React roles show 95% interview-to-hire velocity."
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Summary & Intelligence */}
      {job.summary && (
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-white p-8 rounded-3xl border border-slate-100 flex gap-6">
            <div className="shrink-0 h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Quote size={24} />
            </div>
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
                Executive Briefing
              </h3>
              <p className="text-lg font-medium text-slate-800 leading-relaxed italic">
                "{job.summary}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Skills & Responsibilities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Mandatory Skills */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <div className="h-1 w-4 bg-emerald-500 rounded-full" />
              Mandatory Engineering Stack
            </h3>
            <div className="flex flex-wrap gap-2">
              {(job.mandatorySkills || job.skills || []).map((s: string) => (
                <div
                  key={s}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-black uppercase tracking-tight"
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Preferred Skills */}
          {(job.preferredSkills || []).length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                <div className="h-1 w-4 bg-amber-500 rounded-full" />
                Differentiating Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {job.preferredSkills.map((s: string) => (
                  <div
                    key={s}
                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-xs font-black uppercase tracking-tight"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <div className="h-1 w-4 bg-indigo-500 rounded-full" />
            Core Mission & Responsibilities
          </h3>
          <ul className="space-y-4">
            {(job.responsibilities || []).map((r: string, i: number) => (
              <li key={i} className="flex gap-4 group">
                <div className="h-6 w-6 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm font-medium text-slate-600 leading-relaxed group-hover:text-slate-900 transition-colors">
                  {r}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Full JD Extraction */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-8 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50"
        >
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-slate-400" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              Comprehensive Intelligence Data (JD Full Profile)
            </span>
          </div>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-8 prose prose-slate prose-sm max-w-none">
                {job.jdFullProfile ? (
                  <div className="markdown-body">
                    <ReactMarkdown>{job.jdFullProfile}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-slate-500 italic font-medium">
                    No structured markdown profile available for this legacy
                    requirement. Re-running the AI Sync will generate this view.
                  </p>
                )}
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                    Original RAW Document Trace
                  </h4>
                  <pre className="p-6 bg-slate-50 rounded-2xl text-[11px] text-slate-500 whitespace-pre-wrap font-mono leading-relaxed border border-slate-100 max-h-96 overflow-y-auto">
                    {job.description}
                  </pre>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
