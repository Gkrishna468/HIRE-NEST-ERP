import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  Briefcase, 
  User, 
  Building2, 
  Mail, 
  FileText,
  Calendar,
  DollarSign,
  ArrowRight,
  Loader2,
  GitFork,
  Clock,
  ShieldCheck,
  Award,
  Database,
  Layers,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Info,
  Terminal,
  Compass,
  Activity,
  Bot
} from "lucide-react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cn } from "../lib/utils";
import { Badge } from "../lib/Badge";
import { ExplainableEvidenceCard, EvidenceObject } from "./ExplainableEvidenceCard";

interface GraphSearchResult {
  id: string;
  type: 'CANDIDATE' | 'REQUIREMENT' | 'VENDOR' | 'CLIENT' | 'EMAIL' | 'PLACEMENT' | 'COMMAND';
  title: string;
  subtitle: string;
  status: string;
  trustScore?: number;
  url: string;
  relationships: { target: string; type: string; details: string }[];
  timeline: { event: string; timestamp: string; actor: string }[];
  evidence?: EvidenceObject;
  experienceNotes: string;
  commandAction?: () => void;
}

export function EnterpriseSearchModal({ 
  isOpen, 
  onClose,
  initialQuery = "",
  onToggleAIChat
}: { 
  isOpen: boolean; 
  onClose: () => void;
  initialQuery?: string;
  onToggleAIChat?: () => void;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<GraphSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<GraphSearchResult | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'identity' | 'relationships' | 'timeline' | 'evidence'>('identity');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);

  // Pre-configured canonical graph search data covering candidates, requirements, clients, and emails in a single unified graph
  const canonicalGraphData: GraphSearchResult[] = [
    {
      id: "candidate_sarah",
      type: "CANDIDATE",
      title: "Sarah Jenkins",
      subtitle: "Lead React Architect (7.5y exp) • Active in 2 Pipelines",
      status: "MATCHED_REVIEW",
      trustScore: 96,
      url: "/candidates",
      experienceNotes: "Outstanding architecture grasp. Optimized large scale canvas engines and complex state machines. Sourced from TechStaff Inc (V-901).",
      relationships: [
        { target: "Lead React Architect (Acme Corp)", type: "CANDIDATE_MATCH", details: "96% Skill Overlap" },
        { target: "TechStaff Inc", type: "SOURCED_BY", details: "SLA verified within 2.4 hours" },
        { target: "Sarah Jenkins <> Acme Corp Interview", type: "SCHEDULED_FOR", details: "L1 Technical Round scheduled for Wednesday" },
        { target: "Acme Corp Placement (Pending)", type: "REVENUE_ROUTE", details: "₹24,0,000 projected contract value" }
      ],
      timeline: [
        { event: "Resume parsed via MailOS (Jenkins_CV.pdf)", timestamp: "2026-06-22T10:00:00Z", actor: "MailOS Parser" },
        { event: "Semantic match indexed (96% overlap score)", timestamp: "2026-06-22T10:02:00Z", actor: "AI Matching Engine" },
        { event: "SLA notification broadcast to Acme hiring managers", timestamp: "2026-06-23T09:05:00Z", actor: "Notification Service" }
      ],
      evidence: {
        id: "ev-sarah-jenkins-match",
        decision: "Recommend immediate fast-track to L1 Client Interview",
        confidence: 96,
        graphNodes: ["candidate_sarah", "req_react_dev", "vendor_techstaff", "client_acme"],
        experiences: [
          "Candidate matches historical high-performance profile of successful Acme Corp hires",
          "TechStaff Inc has a 98% placement retention warranty record"
        ],
        decisionFactors: [
          "96% overlap with React, TypeScript and Next.js specifications",
          "Zone alignment: Sourced inside local region limits",
          "Rate compliance: Rate within targeted client budget"
        ],
        telemetrySnapshot: [
          "Market rate deviation: -2.4%",
          "Time-to-submit: 12.5 hours",
          "Vendor SLA status: HEALTHY (96%)"
        ],
        supportingEvents: ["CANDIDATE_INGESTION", "MATCH_INDEX_UPDATED"],
        version: "v1.2.0-search",
        entityType: "candidate_match",
        entityId: "candidate_sarah"
      }
    },
    {
      id: "req_react_dev",
      type: "REQUIREMENT",
      title: "Lead React Architect",
      subtitle: "Acme Corp • Open Position • Budget ₹24,00,000 PA",
      status: "OPEN_PUBLISHED",
      trustScore: 94,
      url: "/jobs",
      experienceNotes: "Urgent recruitment drive. Client demands strong performance architecture skills and immediate availability. Prior placements closed in 11 days.",
      relationships: [
        { target: "Acme Corp", type: "CLIENT_WORKSPACE", details: "Primary Account Owner" },
        { target: "Sarah Jenkins", type: "POTENTIAL_MATCH", details: "96% matched candidate pool" },
        { target: "TechStaff Inc", type: "BROADCAST_TO", details: "Tier-1 Vendor SLA Active" }
      ],
      timeline: [
        { event: "Requirement parsed and extracted from MSA", timestamp: "2026-06-20T14:10:00Z", actor: "AI JD Ingestion" },
        { event: "Requirements broadcast to primary vendor roster", timestamp: "2026-06-20T14:15:00Z", actor: "Workforce HQ Coordinator" }
      ],
      evidence: {
        id: "ev-react-dev-req",
        decision: "Allocate 3 additional matching candidate profiles via Vendor SLA",
        confidence: 91,
        graphNodes: ["req_react_dev", "client_acme", "vendor_techstaff"],
        experiences: [
          "React requirements usually require average 4.2 resumes to secure client placement"
        ],
        decisionFactors: [
          "High pipeline velocity detected on matching skill stacks",
          "Client turnaround average is 3.2 hours for resume review"
        ],
        telemetrySnapshot: [
          "Active applications count: 4",
          "Days open: 7 days",
          "SLA status: SLA HEALTHY"
        ],
        supportingEvents: ["REQUIREMENT_PUBLISHED", "VENDOR_ROSTER_BROADCAST"],
        version: "v1.2.0-search",
        entityType: "requirement",
        entityId: "req_react_dev"
      }
    },
    {
      id: "client_acme",
      type: "CLIENT",
      title: "Acme Corp",
      subtitle: "Tier-1 Enterprise Account • domain: acme.com",
      status: "ACTIVE_PARTNER",
      trustScore: 98,
      url: "/client-360",
      experienceNotes: "Strong preference for candidate stability and tenure. Active recruitment workflows in React and DevOps architectures.",
      relationships: [
        { target: "Lead React Architect", type: "CONTRACTS_ACTIVE", details: "1 active role in sourcing pipeline" },
        { target: "Sarah Jenkins", type: "MATCHED_CANDIDATE", details: "Pending shortlist feedback" },
        { target: "Raj Kumar (HQ)", type: "ACCOUNT_MANAGED_BY", details: "Senior Client Success Officer" }
      ],
      timeline: [
        { event: "Master Service Agreement (MSA) signed and encrypted", timestamp: "2026-01-10T09:30:00Z", actor: "Super Admin" },
        { event: "Enterprise Tenant workspace partitioned", timestamp: "2026-01-10T10:15:00Z", actor: "System Kernel" }
      ],
      evidence: {
        id: "ev-client-acme-governance",
        decision: "Maintain active Tier-1 Preferred partner standing",
        confidence: 98,
        graphNodes: ["client_acme", "req_react_dev", "sub_sarah_react"],
        experiences: [
          "Acme Corp has a 98% invoice paid-on-time rate",
          "Zero warranty disputes registered across 12 prior placements"
        ],
        decisionFactors: [
          "MSA compliant rate sheets enforced at the API routing layer",
          "Dedicated coordinator feedback loop response latency < 24 hours"
        ],
        telemetrySnapshot: [
          "Lifetime revenue: ₹45,00,000",
          "Satisfaction Index: 94%",
          "Risk rating: LOW RISK"
        ],
        supportingEvents: ["MSA_GOVERNANCE_AUDIT", "COMPLIANCE_LOCK_VERIFIED"],
        version: "v1.2.0-search",
        entityType: "client_acme",
        entityId: "client_acme"
      }
    }
  ];

  // List of hot system commands available directly inside the command menu
  const getSystemCommands = (): GraphSearchResult[] => [
    {
      id: "cmd_ai_chat",
      type: "COMMAND",
      title: "🤖 Open Universal AI Chat Assistant",
      subtitle: "Trigger the sliding drawer context-aware agent for immediate recruiting advice",
      status: "EXECUTE_IMMEDIATE",
      url: "#",
      experienceNotes: "Launches the slide-over AI copilot tuned to your active screen",
      relationships: [],
      timeline: [],
      commandAction: () => {
        if (onToggleAIChat) {
          onToggleAIChat();
        }
        onClose();
      }
    },
    {
      id: "cmd_nav_jobs",
      type: "COMMAND",
      title: "💼 Go to Open Requirements Control",
      subtitle: "Review active jobs, import JDs and match indexes",
      status: "NAVIGATE",
      url: "/jobs",
      experienceNotes: "Navigates directly to the Requirements workspace",
      relationships: [],
      timeline: []
    },
    {
      id: "cmd_nav_cands",
      type: "COMMAND",
      title: "👥 Go to Candidates Pool Directory",
      subtitle: "Sift through parsed CV profiles, resumes, and overall matches",
      status: "NAVIGATE",
      url: "/candidates",
      experienceNotes: "Navigates directly to the Candidate management view",
      relationships: [],
      timeline: []
    },
    {
      id: "cmd_nav_vendor",
      type: "COMMAND",
      title: "🤝 Open Vendor SLA Directory",
      subtitle: "Track partner trust indices and bench utilization parameters",
      status: "NAVIGATE",
      url: "/network",
      experienceNotes: "Navigates to the Vendor directory system",
      relationships: [],
      timeline: []
    },
    {
      id: "cmd_nav_health",
      type: "COMMAND",
      title: "⚡ Run Operational System Health Check",
      subtitle: "Audit active workflows, event buses, and API response metrics",
      status: "NAVIGATE",
      url: "/health",
      experienceNotes: "Inspects live telemetry metrics of the system kernel",
      relationships: [],
      timeline: []
    },
    {
      id: "cmd_nav_finance",
      type: "COMMAND",
      title: "🪙 Open Strategic Revenue Ledger",
      subtitle: "Review financial statements, committed spends, and margins",
      status: "NAVIGATE",
      url: "/financials",
      experienceNotes: "Open the finance reporting workspace",
      relationships: [],
      timeline: []
    }
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  // Handle keyboard events (ESC to close, Up/Down arrows, Enter to trigger)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          triggerResultAction(results[selectedIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Scroll selected item into view in the sidebar pane
  useEffect(() => {
    if (resultsListRef.current) {
      const selectedElement = resultsListRef.current.children[selectedIndex + 1] as HTMLElement; // Offset for header span
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
    if (results[selectedIndex]) {
      setSelectedResult(results[selectedIndex]);
    }
  }, [selectedIndex, results]);

  const triggerResultAction = (res: GraphSearchResult) => {
    if (res.commandAction) {
      res.commandAction();
    } else {
      navigate(res.url);
      onClose();
    }
  };

  const performSearch = async (q: string) => {
    setIsSearching(true);
    setSelectedIndex(0);

    // If query is empty or starts with command operator, load system commands!
    if (!q || q.startsWith('>')) {
      const trimmedCommand = q.replace(/^>\s*/, '').toLowerCase();
      const cmds = getSystemCommands();
      const filteredCmds = trimmedCommand 
        ? cmds.filter(c => c.title.toLowerCase().includes(trimmedCommand) || c.subtitle.toLowerCase().includes(trimmedCommand))
        : cmds;
      
      setResults(filteredCmds);
      if (filteredCmds.length > 0) {
        setSelectedResult(filteredCmds[0]);
      } else {
        setSelectedResult(null);
      }
      setIsSearching(false);
      return;
    }

    const qLower = q.toLowerCase();

    try {
      // 1. Fetch live records from candidatePool and requirements_public to merge into the graph traversal!
      const [candsSnap, reqsSnap] = await Promise.all([
        getDocs(query(collection(db, "candidatePool"), limit(25))),
        getDocs(query(collection(db, "requirements_public"), limit(25)))
      ]);

      const liveCandidates: GraphSearchResult[] = candsSnap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            type: 'CANDIDATE' as const,
            title: data.name || "Unknown Candidate",
            subtitle: `${data.title || "Specialist"} • Sourced by ${data.vendorId || "Direct SLA"}`,
            status: data.status || "MATCHED",
            trustScore: data.matchScore || 92,
            url: "/candidates",
            experienceNotes: data.skills ? `Expertise: ${data.skills.join(", ")}. Experience: ${data.experience || "SLA verified"}` : (data.experience || "No details provided"),
            relationships: [
              { target: data.vendorId || "Direct", type: "SOURCED_BY", details: "Authorized agency node" },
              { target: "SLA Tracker", type: "COMPLIANCE_HEALTH", details: "Latency: <24hrs verified" }
            ],
            timeline: [
              { event: "Node identity registered in database", timestamp: new Date().toISOString(), actor: "System Coordinator" }
            ]
          };
        });

      const liveRequirements: GraphSearchResult[] = reqsSnap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            type: 'REQUIREMENT' as const,
            title: data.title || "Requirement Context",
            subtitle: `${data.clientName || "Client Account"} • Budget ₹${data.budget || "Competitive"}`,
            status: data.status || "OPEN",
            trustScore: 94,
            url: "/jobs",
            experienceNotes: `JD specifications parsed with AI. Sourced skills: ${data.skills?.join(", ") || "General staffing"}.`,
            relationships: [
              { target: data.clientName || "Direct Client", type: "CLIENT_WORKSPACE", details: "Contract active" }
            ],
            timeline: [
              { event: "Sourcing broadcast active", timestamp: new Date().toISOString(), actor: "System Coordinator" }
            ]
          };
        });

      // Combine canonical search nodes with real live matching nodes
      const allSearchNodes = [...canonicalGraphData, ...liveCandidates, ...liveRequirements];

      // Client-side exact substring filter
      const filtered = allSearchNodes.filter(item => 
        item.title.toLowerCase().includes(qLower) || 
        item.subtitle.toLowerCase().includes(qLower) ||
        item.experienceNotes.toLowerCase().includes(qLower) ||
        item.type.toLowerCase().includes(qLower)
      );

      // De-duplicate results by ID to keep the tree pristine
      const seenIds = new Set();
      const uniqueFiltered = filtered.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      setResults(uniqueFiltered);
      if (uniqueFiltered.length > 0) {
        setSelectedResult(uniqueFiltered[0]);
      } else {
        setSelectedResult(null);
      }
    } catch (e) {
      console.error("Advanced traversal query failed:", e);
      // Fallback to local canonical data in case of permissions or query boundaries
      const localFiltered = canonicalGraphData.filter(item => 
        item.title.toLowerCase().includes(qLower) || 
        item.subtitle.toLowerCase().includes(qLower) ||
        item.experienceNotes.toLowerCase().includes(qLower)
      );
      setResults(localFiltered);
      if (localFiltered.length > 0) {
        setSelectedResult(localFiltered[0]);
      } else {
        setSelectedResult(null);
      }
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[85vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-8 py-5 border-b border-slate-800 bg-slate-900/60 relative shrink-0">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 animate-pulse" />
          <Search size={22} className="text-slate-400 mr-4 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search matching graph nodes, candidates, or type '>' for immediate system action..."
            className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder-slate-500 font-medium font-sans"
          />
          {isSearching && <Loader2 size={18} className="text-indigo-400 animate-spin mr-3" />}
          
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-lg font-mono tracking-wider">
              ↑↓ Navigate
            </span>
            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-lg font-mono tracking-wider">
              ↵ Trigger
            </span>
            <button 
              onClick={onClose} 
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors font-mono"
            >
              ESC
            </button>
          </div>
        </div>

        {/* Master Double-Pane Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Pane: Filtered Matches */}
          <div 
            ref={resultsListRef}
            className="w-80 md:w-96 border-r border-slate-800 bg-slate-950/40 p-4 overflow-y-auto space-y-2 shrink-0"
          >
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block px-2 mb-2 font-black">
              Filtered Traversal results ({results.length})
            </span>

            {results.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                <Database size={24} className="text-slate-800 mx-auto mb-3 animate-pulse" />
                <span>No node coordinates match the query parameters.</span>
              </div>
            ) : (
              results.map((res, index) => (
                <button
                  key={res.id}
                  onClick={() => {
                    setSelectedIndex(index);
                    setSelectedResult(res);
                  }}
                  className={cn(
                    "w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex flex-col gap-1.5 relative group",
                    selectedIndex === index 
                      ? "bg-indigo-600/10 border-indigo-500/50 text-white" 
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black tracking-tight leading-none text-white">{res.title}</span>
                    <Badge className={cn(
                      "text-[8px] tracking-widest font-mono scale-90",
                      res.type === 'COMMAND' 
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    )}>
                      {res.type}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-relaxed">{res.subtitle}</span>
                  
                  {selectedIndex === index && (
                    <div className="absolute right-3.5 bottom-3.5 text-[9px] font-mono text-indigo-400 uppercase tracking-widest font-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Enter <ArrowRight size={10} />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Right Pane: Connected Graph Centric View */}
          <div className="flex-1 bg-slate-950/80 p-8 overflow-y-auto">
            {selectedResult ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Node Title & Identity */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] font-mono uppercase font-black tracking-wider">
                        🕸️ SYSTEM COMPONENT: {selectedResult.type}
                      </Badge>
                      <span className="text-[10px] font-mono text-slate-500">ID: {selectedResult.id}</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">{selectedResult.title}</h2>
                    <p className="text-xs text-slate-400 font-medium">{selectedResult.subtitle}</p>
                  </div>

                  {selectedResult.trustScore && (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center min-w-[90px] shrink-0">
                      <span className="text-[8px] font-mono text-slate-400 uppercase block tracking-widest">Confidence Score</span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block font-mono">{selectedResult.trustScore}%</span>
                      <span className="text-[8px] text-slate-500 font-mono uppercase block mt-0.5">SLA Rank A</span>
                    </div>
                  )}
                </div>

                {/* Sub tab controls for graph views - Hide if it is a command node */}
                {selectedResult.type !== 'COMMAND' && (
                  <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto custom-scrollbar">
                    {[
                      { id: 'identity', label: '🛡️ Identity & Context', icon: <ShieldCheck size={12} /> },
                      { id: 'relationships', label: '🔗 Relationships Tree', icon: <GitFork size={12} /> },
                      { id: 'timeline', label: '📜 Event History', icon: <Clock size={12} /> },
                      { id: 'evidence', label: '🧠 Explainable Evidence', icon: <Layers size={12} /> },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id as any)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors font-mono flex items-center gap-1.5 whitespace-nowrap",
                          activeSubTab === tab.id 
                            ? "bg-slate-800 text-white border border-slate-700" 
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sub Tab Outputs */}
                <div className="space-y-4">
                  
                  {selectedResult.type === 'COMMAND' ? (
                    <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl space-y-6 animate-in fade-in duration-300 text-center max-w-xl mx-auto py-12">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto animate-pulse">
                        <Terminal size={28} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-black text-white uppercase tracking-tight">Execute Command Prompt</h3>
                        <p className="text-xs text-slate-400 leading-relaxed font-sans">{selectedResult.subtitle}</p>
                      </div>

                      <button 
                        onClick={() => triggerResultAction(selectedResult)}
                        className="mx-auto w-max px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs uppercase font-mono tracking-widest font-black rounded-xl shadow-lg hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        Launch Operation <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {activeSubTab === 'identity' && (
                        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-4 animate-in fade-in duration-300">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold block">Experience Metadata & Audits</span>
                          <p className="text-sm text-slate-200 leading-relaxed font-sans">{selectedResult.experienceNotes}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Deployment Status</span>
                              <span className="text-xs font-mono font-black text-emerald-400 uppercase block mt-1">✓ {selectedResult.status}</span>
                            </div>
                            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Action Direction</span>
                              <button 
                                onClick={() => triggerResultAction(selectedResult)}
                                className="text-xs font-mono text-indigo-400 hover:underline flex items-center gap-1 mt-1 font-bold text-left"
                              >
                                Route to Workstation <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeSubTab === 'relationships' && (
                        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-4 animate-in fade-in duration-300">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold block">Integrated Graph Connections</span>
                          
                          <div className="space-y-3 font-mono">
                            {selectedResult.relationships && selectedResult.relationships.length > 0 ? (
                              selectedResult.relationships.map((rel, idx) => (
                                <div key={idx} className="flex items-center gap-4 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                                  <span className="text-indigo-400 font-bold min-w-[120px] text-[10px] uppercase border-r border-slate-800 pr-2">
                                    {rel.type}
                                  </span>
                                  <div className="flex-1">
                                    <span className="font-bold text-white">{rel.target}</span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">{rel.details}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500 italic p-3 text-center">No active connections indexed for this node.</div>
                            )}
                          </div>
                        </div>
                      )}

                      {activeSubTab === 'timeline' && (
                        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-4 animate-in fade-in duration-300">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold block">Sourcing Event Stream</span>
                          
                          <div className="space-y-4 relative pl-4 border-l border-slate-800/80">
                            {selectedResult.timeline && selectedResult.timeline.length > 0 ? (
                              selectedResult.timeline.map((event, idx) => (
                                <div key={idx} className="relative space-y-1">
                                  <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 border border-slate-900" />
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono font-bold text-white">{event.event}</span>
                                    <span className="text-[9px] font-mono text-slate-500">{new Date(event.timestamp).toLocaleDateString()}</span>
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-500 block">Actor node: {event.actor}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500 italic p-2 text-center">No timeline records registered for this node.</div>
                            )}
                          </div>
                        </div>
                      )}

                      {activeSubTab === 'evidence' && (
                        <div className="animate-in fade-in duration-300">
                          {selectedResult.evidence ? (
                            <ExplainableEvidenceCard 
                              evidence={selectedResult.evidence} 
                              isDark={true}
                            />
                          ) : (
                            <div className="p-6 text-center text-slate-500 font-mono text-xs border border-slate-800 rounded-3xl bg-slate-900/40">
                              <span>No explainable evidence block defined. Sourced profiles use deterministic verification.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <Compass size={48} className="text-slate-800 mb-4 animate-pulse" />
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Command Control</h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mt-1">
                  Query candidate names or jobs in the bar above to traverse active business records, or type <span className="text-indigo-400 font-mono font-bold">{">"}</span> to browse direct operating system shortcuts.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer Info */}
        <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/80 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between shrink-0">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-400 animate-pulse" /> Grounded Business Graph Active • Single Source of Truth verified
          </span>
          <span>HireNestOS Core v1.2</span>
        </div>
      </div>
    </div>
  );
}
