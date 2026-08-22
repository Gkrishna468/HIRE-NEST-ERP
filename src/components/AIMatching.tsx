import React from 'react';
import { CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp, Cpu, Target, Scale, MapPin, ShieldAlert } from 'lucide-react';
import { Badge } from '../lib/Badge';
import { HybridMatchResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface AIMatchingProps {
  result: HybridMatchResult | any;
  candidateName: string;
  onRequestUpdate?: () => void;
}

export const AIMatching: React.FC<AIMatchingProps> = ({ result, candidateName, onRequestUpdate }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const getBadge = () => {
    switch (result.recommendation) {
      case 'STRONG_FIT':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
            <CheckCircle size={10} /> Strong Fit
          </Badge>
        );
      case 'CONSIDER':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1">
            <AlertCircle size={10} /> Consider
          </Badge>
        );
      default:
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 flex items-center gap-1">
            <XCircle size={10} /> Not Suitable
          </Badge>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      <div className="p-4 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white ${
            (result as any).matchScore >= 80 ? 'bg-emerald-500' : (result as any).matchScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
          }`}>
            {(result as any).matchScore}%
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">{candidateName}</h4>
            <div className="flex gap-2 mt-1 flex-wrap">
              {getBadge()}
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {result.breakdown?.totalScore || (result as any).matchScore || 0} pts
              </Badge>
              {(result.aiScreeningStatus === 'AI_SCREENING_UNAVAILABLE' || result.breakdown?.semanticScore === -1) && (
                <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[9px] uppercase font-mono font-bold">
                  PENDING RE-SCORE
                </Badge>
              )}
            </div>
          </div>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-slate-200 rounded-full transition-colors"
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-4 mt-4">
                {/* Strengths */}
                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg">
                  <h5 className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                     <CheckCircle size={12} /> Strengths
                  </h5>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="text-[11px] text-emerald-900">• {s}</li>
                    ))}
                  </ul>
                </div>

                {/* Gaps */}
                <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-lg">
                  <h5 className="text-[10px] font-bold text-rose-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                     <AlertCircle size={12} /> Gaps
                  </h5>
                  <ul className="space-y-1">
                    {result.gaps.map((g, i) => (
                      <li key={i} className="text-[11px] text-rose-900">• {g}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Missing Skills Section */}
              {result.missingSkills && result.missingSkills.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
                  <h5 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <ShieldAlert size={14} className="animate-pulse" /> Critical Missing Skills (JD vs Resume)
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {result.missingSkills.map((s: string, i: number) => (
                      <Badge key={i} className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-mono">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-500 mt-3 italic">
                    Note: These specific technical requirements from the JD were not implicitly found in the parsed profile.
                  </p>
                  {onRequestUpdate && (
                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <button 
                        onClick={onRequestUpdate} 
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors uppercase tracking-widest"
                      >
                         Request Updated Resume
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Score Breakdown */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Matching Logic Decomposition</h5>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <Cpu size={14} className="mx-auto text-indigo-500 mb-1" />
                    <div className="text-[9px] text-slate-400 font-bold">Semantic</div>
                    <div className="text-xs font-black">
                      {result.breakdown?.semanticScore === -1 || result.breakdown?.semanticScore === null || result.aiScreeningStatus === 'AI_SCREENING_UNAVAILABLE'
                        ? 'N/A' 
                        : `${result.breakdown?.semanticScore || result.breakdown?.skillsScore || 0}%`}
                    </div>
                  </div>
                  <div className="text-center">
                    <Target size={14} className="mx-auto text-emerald-500 mb-1" />
                    <div className="text-[9px] text-slate-400 font-bold">Trajectory</div>
                    <div className="text-xs font-black">{result.breakdown?.careerTrajectoryScore || result.breakdown?.experienceScore || 0}%</div>
                  </div>
                  <div className="text-center">
                    <Scale size={14} className="mx-auto text-amber-500 mb-1" />
                    <div className="text-[9px] text-slate-400 font-bold">Domain</div>
                    <div className="text-xs font-black">{result.breakdown?.domainScore || 0}%</div>
                  </div>
                  <div className="text-center">
                    <MapPin size={14} className="mx-auto text-rose-500 mb-1" />
                    <div className="text-[9px] text-slate-400 font-bold">Hard Constraints</div>
                    <div className="text-xs font-black">{result.breakdown?.locationScore !== undefined ? result.breakdown.locationScore + '%' : 'PASS'}</div>
                  </div>
                </div>
              </div>

              {/* AI Assessment */}
              <div className="bg-indigo-900 text-white p-4 rounded-xl shadow-inner shadow-indigo-1000/20">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={14} className="text-indigo-300" />
                  <h5 className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">AI Recruiter Assessment</h5>
                </div>
                <p className="text-[11px] leading-relaxed italic text-indigo-100">
                  "{result.recruiterAssessment}"
                </p>
                <div className="mt-3 pt-3 border-t border-indigo-800 flex items-center justify-between">
                  <div className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Protocol Recommendation</div>
                  <div className="text-[10px] font-black bg-indigo-500 px-2 py-0.5 rounded">
                    {typeof result.nextSteps === 'object' ? JSON.stringify(result.nextSteps) : result.nextSteps}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
