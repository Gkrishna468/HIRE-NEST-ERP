// src/views/AIOpsCenter/BusinessOperations.tsx
import React from "react";
import { 
  Eye, 
  ChevronRight, 
  Clock, 
  ShieldAlert, 
  Info,
  Sliders,
  UserCheck
} from "lucide-react";
import { cn } from "../../lib/utils";
import { formatINR } from "../../lib/currency";
import { RequirementOwnership } from "./AIOpsTypes";

interface BusinessOperationsProps {
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  selectedReq: RequirementOwnership | null;
  setSelectedReq: (req: RequirementOwnership | null) => void;
  fallbackRequirements: RequirementOwnership[];
}

export default function BusinessOperations({
  activeSubTab,
  selectedReq,
  setSelectedReq,
  fallbackRequirements
}: BusinessOperationsProps) {
  
  // Clean presentation-based static detail map for each requirement
  const reqDetailsMap: Record<string, { techStack: string[]; compensation: string; priority: "HIGH" | "MEDIUM" | "CRITICAL"; timezone: string }> = {
    "req-091": {
      techStack: ["Kubernetes", "Golang", "Docker", "AWS"],
      compensation: "₹28 LPA - ₹35 LPA Base",
      priority: "CRITICAL",
      timezone: "IST / Hybrid"
    },
    "req-092": {
      techStack: ["TypeScript", "Next.js", "TailwindCSS", "Node.js"],
      compensation: "₹22 LPA - ₹28 LPA Base",
      priority: "HIGH",
      timezone: "IST / Remote"
    },
    "req-093": {
      techStack: ["Python", "PyTorch", "FastAPI", "PostgreSQL"],
      compensation: "₹35 LPA - ₹45 LPA Base",
      priority: "CRITICAL",
      timezone: "IST / Bengaluru"
    },
    "req-094": {
      techStack: ["Java", "Spring Boot", "Microservices", "GCP"],
      compensation: "₹25 LPA - ₹32 LPA Base",
      priority: "MEDIUM",
      timezone: "IST / Hybrid"
    }
  };

  const currentDetails = selectedReq ? (reqDetailsMap[selectedReq.id] || {
    techStack: ["General Engineering"],
    compensation: "Market Rate",
    priority: "MEDIUM",
    timezone: "Global"
  }) : null;

  return (
    <div className="flex flex-col flex-1 gap-6">
      
      {/* Requirement Observatory tab */}
      {activeSubTab === 'observatory' && (
        <div className="space-y-6 flex-1 flex flex-col">
          <div className="flex justify-between items-center border-b border-slate-900 pb-4">
            <div>
              <h2 className="text-lg font-black text-white">Requirement Observatory</h2>
              <p className="text-xs text-slate-400">Complete presentation registry tracking ownership, strategic SLA health, and recruiter alignments.</p>
            </div>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full font-bold">
              Observatory Active
            </span>
          </div>

          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            {/* Active requirements observer list */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs bg-[#070A13] border border-slate-900 rounded-2xl overflow-hidden">
                <thead>
                  <tr className="bg-[#0c111f] border-b border-slate-900 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                    <th className="p-4">Requirement Details</th>
                    <th className="p-4">Primary BDM</th>
                    <th className="p-4">Assigned Recruiter</th>
                    <th className="p-4">SLA status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {fallbackRequirements.map((req) => (
                    <tr 
                      key={req.id}
                      onClick={() => setSelectedReq(req)}
                      className={cn("hover:bg-[#0d1222] transition-colors cursor-pointer", 
                        selectedReq?.id === req.id ? "bg-indigo-600/5" : ""
                      )}
                    >
                      <td className="p-4">
                        <span className="font-bold text-white block">{req.title}</span>
                        <span className="text-[10px] text-slate-500">{req.client} • {req.id}</span>
                      </td>
                      <td className="p-4 font-medium text-slate-300">{req.bdm}</td>
                      <td className="p-4 font-medium text-slate-300">{req.recruiter}</td>
                      <td className="p-4">
                        <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border", 
                          req.slaStatus === 'healthy' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          req.slaStatus === 'warning' ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" :
                          "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        )}>
                          {req.slaStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <ChevronRight size={14} className="inline text-slate-500 group-hover:text-white" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Requirement Detail observatory drawer */}
            <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-2xl p-5 flex flex-col justify-between min-h-[500px]">
              {selectedReq && currentDetails ? (
                <div className="space-y-6 flex-1 flex flex-col">
                  {/* Observatory header */}
                  <div className="border-b border-slate-900 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">Observatory Registry Detail</span>
                        <h4 className="text-sm font-black text-white">{selectedReq.title}</h4>
                        <p className="text-[10px] text-slate-500">{selectedReq.client} • #{selectedReq.id}</p>
                      </div>
                      <span className={cn("text-[9px] font-bold uppercase px-2.5 py-0.5 border rounded-full",
                        selectedReq.slaStatus === 'healthy' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        selectedReq.slaStatus === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                        "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      )}>
                        {selectedReq.slaStatus}
                      </span>
                    </div>
                  </div>

                  {/* Operational Alignment Profile */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Operational Profile</span>
                    <div className="bg-[#0b101d] border border-slate-900/80 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <UserCheck size={13} className="text-indigo-400" /> Primary BDM
                        </span>
                        <span className="font-bold text-white">{selectedReq.bdm}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <UserCheck size={13} className="text-indigo-400" /> Lead Recruiter
                        </span>
                        <span className="font-bold text-white">{selectedReq.recruiter}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Clock size={13} className="text-indigo-400" /> Target Timezone
                        </span>
                        <span className="font-bold text-slate-300">{currentDetails.timezone}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Sliders size={13} className="text-indigo-400" /> Compensation Band
                        </span>
                        <span className="font-bold text-emerald-400">{currentDetails.compensation}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <ShieldAlert size={13} className="text-indigo-400" /> SLA Priority
                        </span>
                        <span className={cn("font-bold text-xs", 
                          currentDetails.priority === 'CRITICAL' ? "text-rose-400" : "text-amber-400"
                        )}>{currentDetails.priority}</span>
                      </div>
                    </div>
                  </div>

                  {/* Required Technologies Scope */}
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Technology Stack Scope</span>
                    <div className="flex flex-wrap gap-2">
                      {currentDetails.techStack.map((tech) => (
                        <span 
                          key={tech} 
                          className="text-[10px] font-mono px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg font-medium"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Informational Guidance */}
                  <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-2.5">
                    <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      SLA states and events for this requirement are managed continuously by the global <span className="text-indigo-300 font-semibold">Workflow Orchestrator</span> platform domain service. Match scorecards and recruiter overrides are handled in the <span className="text-indigo-300 font-semibold">Decision Intelligence</span> service layer.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-slate-500 space-y-2">
                  <Eye size={36} className="text-slate-600" />
                  <p className="text-xs font-bold uppercase tracking-wider">Select Requirement to Observe</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px]">Audits direct responsibility mappings, pipeline statuses, technical stack scope, and SLA priority tiers.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Success Health Hub Subtab */}
      {activeSubTab === 'customer_health' && (
        <CustomerHealthDashboard />
      )}
    </div>
  );
}

// Client Health Profile Interface
interface ClientHealthProfile {
  id: string;
  name: string;
  healthScore: number;
  automationRate: number;
  trustScore: number;
  activeRequirements: number;
  placementsInfluence: number;
  estimatedSavings: number;
  supportRisk: "LOW" | "MEDIUM" | "HIGH";
  renewalRisk: "LOW" | "MEDIUM" | "HIGH";
  incidentCount: number;
  lastSyncDate: string;
  complianceRating: number;
  recentActivity: string;
}

const FALLBACK_CLIENT_HEALTH: ClientHealthProfile[] = [
  {
    id: "cl-001",
    name: "TechCorp Systems",
    healthScore: 91,
    automationRate: 85,
    trustScore: 96,
    activeRequirements: 5,
    placementsInfluence: 12,
    estimatedSavings: 185000,
    supportRisk: "LOW",
    renewalRisk: "LOW",
    incidentCount: 1,
    lastSyncDate: "July 15, 2026",
    complianceRating: 98,
    recentActivity: "AI recruiter pre-screened 14 candidates for Cloud Architect. Recruiter approved."
  },
  {
    id: "cl-002",
    name: "Initech Corp",
    healthScore: 94,
    automationRate: 92,
    trustScore: 98,
    activeRequirements: 3,
    placementsInfluence: 8,
    estimatedSavings: 120000,
    supportRisk: "LOW",
    renewalRisk: "LOW",
    incidentCount: 0,
    lastSyncDate: "July 14, 2026",
    complianceRating: 100,
    recentActivity: "Automatic GTM pipeline engaged. 5 candidate profiles synced with partner bench."
  },
  {
    id: "cl-003",
    name: "InnovateLabs Ltd",
    healthScore: 88,
    automationRate: 78,
    trustScore: 92,
    activeRequirements: 4,
    placementsInfluence: 6,
    estimatedSavings: 95000,
    supportRisk: "MEDIUM",
    renewalRisk: "LOW",
    incidentCount: 2,
    lastSyncDate: "July 12, 2026",
    complianceRating: 94,
    recentActivity: "Escalation ticket solved regarding machine learning candidate experience feedback loop."
  },
  {
    id: "cl-004",
    name: "GlobalFinance Corp",
    healthScore: 82,
    automationRate: 64,
    trustScore: 85,
    activeRequirements: 2,
    placementsInfluence: 4,
    estimatedSavings: 65000,
    supportRisk: "HIGH",
    renewalRisk: "MEDIUM",
    incidentCount: 4,
    lastSyncDate: "July 15, 2026",
    complianceRating: 88,
    recentActivity: "SLA breach limits reached for VP Strategic Search. Intervened with manual BDM routing."
  }
];

function CustomerHealthDashboard() {
  const [clients, setClients] = React.useState<ClientHealthProfile[]>(FALLBACK_CLIENT_HEALTH);
  const [selectedClientId, setSelectedClientId] = React.useState<string>("cl-001");
  const [dispatchSuccess, setDispatchSuccess] = React.useState<string | null>(null);

  const selectedClient = React.useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || clients[0];
  }, [clients, selectedClientId]);

  const stats = React.useMemo(() => {
    const totalScore = clients.reduce((acc, c) => acc + c.healthScore, 0);
    const avgHealth = Math.round(totalScore / clients.length);
    const totalSavings = clients.reduce((acc, c) => acc + c.estimatedSavings, 0);
    const highRisks = clients.filter(c => c.supportRisk === "HIGH" || c.renewalRisk === "HIGH").length;
    return {
      avgHealth,
      totalSavings,
      highRisks
    };
  }, [clients]);

  const handleDispatchAdvisory = (clientName: string) => {
    setDispatchSuccess(`Success! ROI Audit & Strategic Health Advisory report dispatched to ${clientName} leadership team.`);
    setTimeout(() => setDispatchSuccess(null), 5000);
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Customer Success & Health Hub</h2>
          <p className="text-xs text-slate-400">Continuous auditing of corporate accounts, platform adoption, trust ratings, and direct operational ROI.</p>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
          Ecosystem CS Monitor Active
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Avg Customer Health</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-white">{stats.avgHealth}%</span>
            <span className="text-[9px] text-emerald-400 font-bold">NOMINAL</span>
          </div>
        </div>
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Account Automation Rate</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-indigo-400">79.8%</span>
            <span className="text-[9px] text-slate-500 font-bold">Average</span>
          </div>
        </div>
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Total Client ROI Saved</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-emerald-400">{formatINR(stats.totalSavings)}</span>
            <span className="text-[9px] text-emerald-400 font-bold">Platform-wide</span>
          </div>
        </div>
        <div className="bg-[#070A13] border border-slate-900 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Support/Renewal Risks</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-black font-mono ${stats.highRisks > 0 ? "text-rose-400 animate-pulse" : "text-slate-400"}`}>
              {stats.highRisks} Accounts
            </span>
            <span className="text-[9px] text-slate-500 font-bold">Action Needed</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-6">
        {/* Client Selector List */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs bg-[#070A13] border border-slate-900 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-[#0c111f] border-b border-slate-900 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="p-4">Customer Name</th>
                <th className="p-4">Health Score</th>
                <th className="p-4">AI Trust Rating</th>
                <th className="p-4">Support Risk</th>
                <th className="p-4">Renewal Risk</th>
                <th className="p-4 text-right">Estimated ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={cn("hover:bg-[#0d1222] transition-colors cursor-pointer",
                    selectedClientId === client.id ? "bg-indigo-600/5" : ""
                  )}
                >
                  <td className="p-4">
                    <span className="font-bold text-white block">{client.name}</span>
                    <span className="text-[10px] text-slate-500">{client.activeRequirements} Active Reqs • ID: {client.id}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full", 
                            client.healthScore > 90 ? "bg-emerald-500" :
                            client.healthScore > 80 ? "bg-indigo-500" : "bg-rose-500"
                          )}
                          style={{ width: `${client.healthScore}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-white">{client.healthScore}%</span>
                    </div>
                  </td>
                  <td className="p-4 font-bold font-mono text-indigo-400">{client.trustScore}%</td>
                  <td className="p-4">
                    <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      client.supportRisk === 'LOW' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      client.supportRisk === 'MEDIUM' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                    )}>
                      {client.supportRisk}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      client.renewalRisk === 'LOW' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      client.renewalRisk === 'MEDIUM' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      {client.renewalRisk}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-emerald-400">
                    {formatINR(client.estimatedSavings)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detailed Customer Health Profile Drawer */}
        <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-2xl p-5 flex flex-col justify-between min-h-[500px]">
          <div className="space-y-5">
            <div className="border-b border-slate-900 pb-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">CS Health Profiler</span>
              <h4 className="text-sm font-black text-white">{selectedClient.name}</h4>
              <p className="text-[10px] text-slate-500">Last synchronized audit: {selectedClient.lastSyncDate}</p>
            </div>

            {/* Health Elements Breakdown */}
            <div className="space-y-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Health Elements Breakdown</span>
              <div className="space-y-2.5">
                {/* Score 1 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-slate-400">
                    <span>Automation Rate (AI Sourcing Alignment)</span>
                    <span className="font-bold text-white">{selectedClient.automationRate}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: `${selectedClient.automationRate}%` }} />
                  </div>
                </div>

                {/* Score 2 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-slate-400">
                    <span>Ecosystem Trust Score</span>
                    <span className="font-bold text-white">{selectedClient.trustScore}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${selectedClient.trustScore}%` }} />
                  </div>
                </div>

                {/* Score 3 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-slate-400">
                    <span>SLA Compliance Rating</span>
                    <span className="font-bold text-white">{selectedClient.complianceRating}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${selectedClient.complianceRating}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Business Outcomes & ROI block */}
            <div className="space-y-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Attributed Business Outcomes</span>
              <div className="grid grid-cols-2 gap-3 bg-[#0b101d] border border-slate-900/80 p-3.5 rounded-xl">
                <div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Active Requirements</span>
                  <span className="text-base font-black font-mono text-white">{selectedClient.activeRequirements} Active</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Placements Influenced</span>
                  <span className="text-base font-black font-mono text-white">{selectedClient.placementsInfluence} Placed</span>
                </div>
                <div className="pt-2 border-t border-slate-900/60">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Total Hours Saved</span>
                  <span className="text-sm font-black font-mono text-indigo-400">{(selectedClient.activeRequirements * 18).toFixed(0)} Hrs</span>
                </div>
                <div className="pt-2 border-t border-slate-900/60">
                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Financial ROI (Est.)</span>
                  <span className="text-sm font-black font-mono text-emerald-400">{formatINR(selectedClient.estimatedSavings)}</span>
                </div>
              </div>
            </div>

            {/* Incidents & Activity Feed */}
            <div className="space-y-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Security & Incident Analytics</span>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/80 space-y-2 text-xs">
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Incident Rate: {selectedClient.incidentCount} logged</span>
                  <span className={cn("font-bold px-1.5 py-0.5 rounded", 
                    selectedClient.incidentCount === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  )}>
                    {selectedClient.incidentCount === 0 ? "STABLE" : "ATTENTION"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal italic">
                  " {selectedClient.recentActivity} "
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900/60 space-y-3">
            {dispatchSuccess && (
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-lg border border-emerald-500/20 text-center font-bold">
                {dispatchSuccess}
              </div>
            )}
            <button
              onClick={() => handleDispatchAdvisory(selectedClient.name)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 shadow"
            >
              Dispatch Advisory & ROI Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
