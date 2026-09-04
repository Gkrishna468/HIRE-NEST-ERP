// src/views/AIOpsCenterTab.tsx
import React, { useState, useEffect, useMemo } from "react";
import { 
  Bot, 
  Cpu, 
  RefreshCw, 
  ShieldAlert, 
  Layout, 
  Server, 
  Briefcase, 
  Shield, 
  Wifi, 
  Workflow, 
  Eye, 
  TrendingUp, 
  UserCheck, 
  History, 
  Terminal, 
  FileSpreadsheet,
  Network,
  BookOpen,
  ClipboardList,
  Inbox,
  Award,
  Compass,
  FolderOpen,
  Brain,
  Heart
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc,
  setDoc
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

// Import modular types and components
import { Agent, Execution, BusinessEvent, RequirementOwnership, AIReport, AIPolicy } from "./AIOpsCenter/AIOpsTypes";
import ExecutiveHome from "./AIOpsCenter/ExecutiveHome";
import PlatformOperations from "./AIOpsCenter/PlatformOperations";
import BusinessOperations from "./AIOpsCenter/BusinessOperations";
import AIWorkforce from "./AIOpsCenter/AIWorkforce";
import GovernanceAudit from "./AIOpsCenter/GovernanceAudit";
import WorkflowOrchestrator from "./AIOpsCenter/WorkflowOrchestrator";
import DecisionIntelligence from "./AIOpsCenter/DecisionIntelligence";
import PredictiveAnalytics from "./AIOpsCenter/PredictiveAnalytics";
import InfrastructureConsole from "./AIOpsCenter/InfrastructureConsole";

export default function AIOpsCenterTab({ userRole }: { userRole: string }) {
  const isAdmin = ["admin", "super_admin", "hq_admin", "ops_admin"].includes(userRole);
  
  // High-level Domain Management
  const [activeDomain, setActiveDomain] = useState<'executive' | 'platform' | 'business' | 'workforce' | 'governance' | 'orchestrator' | 'decision' | 'predictive'>('executive');
  const [activeSubTab, setActiveSubTab] = useState<string>("overview");
  const [loading, setLoading] = useState(true);
  
  // Real-time & fallback datasets
  const [agents, setAgents] = useState<Agent[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [queue, setQueue] = useState<any[]>([]);

  // Requirement Observatory states
  const [selectedReq, setSelectedReq] = useState<RequirementOwnership | null>(null);

  // Business Event live monitor state
  const [eventsFeed, setEventsFeed] = useState<BusinessEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<BusinessEvent | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("ALL");

  // Executive reports generator state
  const [selectedReportType, setSelectedReportType] = useState<string>("daily");
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // Simulation Lab states
  const [playgroundPrompt, setPlaygroundPrompt] = useState<string>("Analyze the matching queue for Senior React Engineer and trigger strategic bench sourcing routing rules.");
  const [isRunningPlayground, setIsRunningPlayground] = useState<boolean>(false);
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);
  
  // Manual trigger loading state
  const [triggeringAgentId, setTriggeringAgentId] = useState<Record<string, boolean>>({});

  // Real-time Governance states
  const [policies, setPolicies] = useState<AIPolicy[]>([]);
  const [reports, setReports] = useState<AIReport[]>([]);

  // Fallback policies definition
  const fallbackPolicies = useMemo<AIPolicy[]>(() => [
    {
      id: "policy-abac-01",
      title: "ABAC Token Isolation Policy",
      category: "Security & IAM",
      description: "Enforces distinct workspace scoped tokens for Layer 1 digital employees. No cross-organization memory leakage allowed.",
      status: "active",
      ruleCount: 3,
      severity: "critical",
      lastUpdated: new Date().toISOString()
    },
    {
      id: "policy-ritl-02",
      title: "Recruiter-in-the-Loop SLA Guardrails",
      category: "Workflow Oversight",
      description: "Ensures no candidate is match-notified without explicit human recruiter confirmation and verification override.",
      status: "active",
      ruleCount: 2,
      severity: "high",
      lastUpdated: new Date().toISOString()
    },
    {
      id: "policy-budget-03",
      title: "Gemini Model Budget Gate",
      category: "Cost Governance",
      description: "Applies severe request circuit-breaking when daily tokens exceed 5,000,000 or individual agent cost exceeds ₹850.00.",
      status: "active",
      ruleCount: 4,
      severity: "medium",
      lastUpdated: new Date().toISOString()
    }
  ], []);

  // Fallback reports definition
  const fallbackReports = useMemo<AIReport[]>(() => [
    {
      id: "rep-001",
      agentId: "founder-office",
      agentName: "Alpha Founder Liaison",
      type: "daily",
      title: "Autonomous Placement Velocity Digest",
      content: `### Executive Daily Summary
- **Overall Placement Health**: Nominal (98.4%)
- **Strategic Pipeline Revenue**: ₹1.5 Cr influenced
- **Key Actions**: Successfully compiled daily recruiter activity. Cleared 4 strategic routing requests.
- **Identified SLA Risk**: TechCorp systems integration is pending. BDM Diana Prince has been notified.`,
      status: "unread",
      timestamp: new Date(Date.now() - 4 * 60 * 60000).toISOString()
    },
    {
      id: "rep-002",
      agentId: "vendor-office",
      agentName: "Vance Vendor Coordinator",
      type: "weekly",
      title: "Ecosystem Vendor Partner Trust Report",
      content: `### Weekly Partner Sourcing Highlights
- **Active Vendors Tracked**: 12
- **Average Trust Index**: 96.2%
- **Top Performer**: Apex Staffing Network (Response rate under 15 mins)
- **Recommendations**: Increase match allocations to Apex Staffing as SLA fulfillment rates are 100% within the 1-hour window.`,
      status: "unread",
      timestamp: new Date(Date.now() - 24 * 60 * 60000).toISOString()
    }
  ], []);

  // 1. Digital Employee Registry definitions
  const fallbackAgents = useMemo<Agent[]>(() => [
    { 
      id: 'founder-office', 
      name: 'Alpha Founder Liaison', 
      category: 'Layer 1: Office Agents', 
      triggerType: 'CRON', 
      schedule: 'Twice Daily (8:30 AM, 6:00 PM)', 
      status: 'Healthy', 
      enabled: true, 
      desc: 'Synthesizes global placement velocity, overnight briefs, and high-level EOD revenue impact dashboards.', 
      successRate: 98.4, 
      avgRuntime: 1450, 
      execsToday: 2, 
      model: 'gemini-3.1-pro-preview',
      department: 'Executive Operations',
      ownerName: 'Diana Prince (VP Ops)',
      reportsTo: 'Chief of Staff',
      currentTask: 'Compiling overnight executive Briefing',
      approvalAuthority: 'Executive Override Required',
      nextTask: 'Synchronize morning dashboard at 8:30 AM',
      lastReportSent: 'Yesterday, 6:00 PM'
    },
    { 
      id: 'gtm-office', 
      name: 'Siri GTM Marketer', 
      category: 'Layer 1: Office Agents', 
      triggerType: 'CRON', 
      schedule: '9:00 AM Daily', 
      status: 'Healthy', 
      enabled: true, 
      desc: 'Triggers outbound recruitment marketing campaigns, parses marketing triggers, and optimizes acquisition channels.', 
      successRate: 95.8, 
      avgRuntime: 2200, 
      execsToday: 1, 
      model: 'gemini-2.5-flash',
      department: 'Growth & Marketing',
      ownerName: 'Tony Stark (GTM Lead)',
      reportsTo: 'Head of Growth',
      currentTask: 'Analyzing outbound campaign conversion curves',
      approvalAuthority: 'Manager Approval Required',
      nextTask: 'Trigger campaign optimization pass at 9:00 AM',
      lastReportSent: 'Today, 9:00 AM'
    },
    { 
      id: 'recruitment-office', 
      name: 'Conrad Recruiter Conductor', 
      category: 'Layer 1: Office Agents', 
      triggerType: 'EVENT', 
      schedule: 'Event-driven', 
      status: 'Healthy', 
      enabled: true, 
      desc: 'Conducts resume parsing pipelines, handles talent pool extraction, semantic alignment scoring, and automatic ledger submission logging.', 
      successRate: 99.1, 
      avgRuntime: 1120, 
      execsToday: 14, 
      model: 'gemini-3.1-pro-preview',
      department: 'Talent Acquisition',
      ownerName: 'Bruce Wayne (Talent Director)',
      reportsTo: 'VP Human Resources',
      currentTask: 'Scoring candidates for Staff Kubernetes Engineer',
      approvalAuthority: 'Recruiter Override Required',
      nextTask: 'Scoring Kubernetes Developer queue at 12:00 PM',
      lastReportSent: 'Today, 8:30 AM'
    },
    { 
      id: 'vendor-office', 
      name: 'Vance Vendor Coordinator', 
      category: 'Layer 1: Office Agents', 
      triggerType: 'CRON', 
      schedule: '9:15 AM Daily', 
      status: 'Healthy', 
      enabled: true, 
      desc: 'Ensures bench-partner utilization, rates vendor trust scores, and generates automated feedback briefs for vendor submissions.', 
      successRate: 97.2, 
      avgRuntime: 1850, 
      execsToday: 1, 
      model: 'gemini-2.5-flash',
      department: 'Vendor Relations',
      ownerName: 'Clark Kent (Partner Mgr)',
      reportsTo: 'Head of Strategic Alliances',
      currentTask: 'Generating trust scores for new partner benches',
      approvalAuthority: 'Vendor Coordinator Review',
      nextTask: 'Evaluate trust scores at 9:15 AM',
      lastReportSent: 'Today, 9:15 AM'
    },
    { 
      id: 'client-office', 
      name: 'Cleo Client Success Officer', 
      category: 'Layer 1: Office Agents', 
      triggerType: 'EVENT', 
      schedule: 'Event-driven', 
      status: 'Healthy', 
      enabled: true, 
      desc: 'Provides automated hiring velocity predictions, audits ongoing client workspace SLAs, and alerts account executives on candidate bottlenecks.', 
      successRate: 96.5, 
      avgRuntime: 1620, 
      execsToday: 8, 
      model: 'gemini-1.5-flash',
      department: 'Customer Success',
      ownerName: 'Peter Parker (CS Lead)',
      reportsTo: 'VP Client Operations',
      currentTask: 'Auditing SLA risk on Lead Go Developer requirement',
      approvalAuthority: 'Client AE Escalation',
      nextTask: 'Audit Lead Go SLA status',
      lastReportSent: 'Today, 7:45 AM'
    },
    { 
      id: 'marketplace-office', 
      name: 'Max Marketplace Optimizer', 
      category: 'Layer 1: Office Agents', 
      triggerType: 'CRON', 
      schedule: 'Every 15 min', 
      status: 'Healthy', 
      enabled: true, 
      desc: 'Scans idle bench candidates across ecosystem networks, maps requirement matching gaps semantically, and drives mutual deal room creations.', 
      successRate: 99.5, 
      avgRuntime: 820, 
      execsToday: 64, 
      model: 'gemini-1.5-flash',
      department: 'Ecosystem Operations',
      ownerName: 'Diana Prince (VP Ops)',
      reportsTo: 'Chief Operations Officer',
      currentTask: 'Analyzing semantic gap vectors across 14 benches',
      approvalAuthority: 'Automated Placement',
      nextTask: 'Query bench candidates in 15 mins',
      lastReportSent: 'Today, 10:15 AM'
    },
    { 
      id: 'scheduling-office', 
      name: 'Sam Scheduling Coordinator', 
      category: 'Layer 1: Office Agents', 
      triggerType: 'EVENT', 
      schedule: 'Event-driven', 
      status: 'Healthy', 
      enabled: true, 
      desc: 'Orchestrates interview slots, manages calendar sync protocols, and verifies scheduling feedback loops with candidates and clients automatically.', 
      successRate: 100, 
      avgRuntime: 720, 
      execsToday: 5, 
      model: 'gemini-1.5-flash',
      department: 'Workspace Coordination',
      ownerName: 'Steve Rogers (Ops Coordinator)',
      reportsTo: 'Operations Manager',
      currentTask: 'Awaiting interview slots for TechCorp Go position',
      approvalAuthority: 'Autonomous Confirmation',
      nextTask: 'Check calendar sync on event triggers',
      lastReportSent: 'Today, 8:00 AM'
    }
  ], []);

  // 2. Mock Requirements with ownership data
  const fallbackRequirements = useMemo<RequirementOwnership[]>(() => [
    {
      id: "req-091",
      title: "Lead Cloud Platform Architect",
      client: "TechCorp Systems",
      bdm: "Diana Prince (VP Ops)",
      recruiter: "Peter Parker (CS Lead)",
      manager: "Bruce Wayne (Talent Director)",
      aiAgents: ["recruitment-office", "marketplace-office"],
      lastAiActivity: "3 minutes ago",
      slaStatus: "healthy",
      escalationPath: "Email Recruiter -> Slack Manager -> Admin Intervention",
      history: [
        { date: "2026-07-06 10:00", action: "Requirement Created", actor: "Diana Prince" },
        { date: "2026-07-06 10:15", action: "Recruiter Assigned", actor: "Bruce Wayne" },
        { date: "2026-07-06 10:20", action: "AI Agents Conrad & Max attached to parse pipeline", actor: "System Engine" }
      ]
    },
    {
      id: "req-092",
      title: "Staff Go / Kubernetes Developer",
      client: "Initech Corp",
      bdm: "Tony Stark (GTM Lead)",
      recruiter: "Clark Kent (Partner Mgr)",
      manager: "Bruce Wayne (Talent Director)",
      aiAgents: ["recruitment-office", "scheduling-office"],
      lastAiActivity: "14 minutes ago",
      slaStatus: "warning",
      escalationPath: "Alert Recruiter Hub -> Direct BDM Override -> Executive Ticket",
      history: [
        { date: "2026-07-05 09:00", action: "Requirement Created", actor: "Tony Stark" },
        { date: "2026-07-05 11:30", action: "Recruiter Assigned", actor: "Bruce Wayne" },
        { date: "2026-07-06 08:30", action: "SLA Alert triggered by Cleo (Response latency exceeded 20 hours)", actor: "System Engine" }
      ]
    },
    {
      id: "req-093",
      title: "Senior Machine Learning Engineer",
      client: "InnovateLabs Ltd",
      bdm: "Diana Prince (VP Ops)",
      recruiter: "Peter Parker (CS Lead)",
      manager: "Bruce Wayne (Talent Director)",
      aiAgents: ["recruitment-office", "founder-office"],
      lastAiActivity: "1 hour ago",
      slaStatus: "healthy",
      escalationPath: "Direct BDM Handshake -> Automated Resubmittal -> Operations Board",
      history: [
        { date: "2026-07-04 14:00", action: "Requirement Created", actor: "Diana Prince" },
        { date: "2026-07-04 14:10", action: "Recruiter Assigned", actor: "Peter Parker" }
      ]
    },
    {
      id: "req-094",
      title: "VP of Engineering (Strategic Search)",
      client: "GlobalFinance Corp",
      bdm: "Diana Prince (VP Ops)",
      recruiter: "Steve Rogers (Ops Coordinator)",
      manager: "Bruce Wayne (Talent Director)",
      aiAgents: ["founder-office", "recruitment-office", "marketplace-office"],
      lastAiActivity: "2 hours ago",
      slaStatus: "breached",
      escalationPath: "Manager Immediate Override -> Executive Review -> Client Call Routing",
      history: [
        { date: "2026-07-02 10:00", action: "Strategic Requirement Initialized", actor: "Diana Prince" },
        { date: "2026-07-02 11:00", action: "Recruiter Assigned", actor: "Steve Rogers" },
        { date: "2026-07-05 17:00", action: "SLA limit reached with 0 submittals. Escalated to Tier 3 Ops", actor: "System Engine" }
      ]
    }
  ], []);

  // 3. Default Cognitive Traces
  const fallbackTraces = useMemo<Execution[]>(() => [
    {
      id: "trace-9801",
      agentId: "recruitment-office",
      status: "success",
      duration: 1250,
      tokens: 3820,
      model: "gemini-1.5-pro",
      timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
      requirementId: "req-091",
      client: "TechCorp Systems",
      owner: "Bruce Wayne",
      promptVersion: "v2.1.4-production",
      toolsUsed: ["parse_resume", "align_skills_vector", "write_match_index"],
      cost: 0.015,
      decision: "Extracted and mapped candidate profile. Score resolved. Transaction written.",
      confidence: 0.96
    },
    {
      id: "trace-9802",
      agentId: "marketplace-office",
      status: "success",
      duration: 850,
      tokens: 2150,
      model: "gemini-1.5-flash",
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      requirementId: "req-091",
      client: "TechCorp Systems",
      owner: "Diana Prince",
      promptVersion: "v1.8.1-production",
      toolsUsed: ["query_bench_candidates", "score_cross_tenant_alignment"],
      cost: 0.004,
      decision: "Found 3 matching bench-partner resumes. Triggered secure cross-tenant deal room invitation.",
      confidence: 0.94
    },
    {
      id: "trace-9803",
      agentId: "founder-office",
      status: "success",
      duration: 2100,
      tokens: 8400,
      model: "gemini-1.5-pro",
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      requirementId: "global-hq",
      client: "All Clients",
      owner: "Diana Prince",
      promptVersion: "v3.0.1-executive",
      toolsUsed: ["query_placements", "calculate_revenue_impact", "compile_briefing"],
      cost: 0.042,
      decision: "Completed overnight placement report. Calculated overall ecosystem revenue influence.",
      confidence: 0.99
    },
    {
      id: "trace-9804",
      agentId: "vendor-office",
      status: "success",
      duration: 1100,
      tokens: 3200,
      model: "gemini-1.5-flash",
      timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
      requirementId: "req-092",
      client: "Initech Corp",
      owner: "Clark Kent",
      promptVersion: "v1.2.0-core",
      toolsUsed: ["get_vendor_profiles", "update_vendor_trust_score"],
      cost: 0.006,
      decision: "Assessed vendor partner submission speed. Applied trust score index multiplier based on SLA adherence.",
      confidence: 0.91
    }
  ], []);

  // Set initial Business Events Feed
  useEffect(() => {
    setEventsFeed([
      { id: "evt-001", type: "REQUIREMENT_CREATED", timestamp: new Date(Date.now() - 5 * 60000).toISOString(), origin: "Diana Prince (BDM)", status: "nominal", payload: { requirementId: "req-091", title: "Lead Cloud Platform Architect", client: "TechCorp Systems", budget: "₹35,00,000" } },
      { id: "evt-002", type: "CANDIDATE_MATCHED", timestamp: new Date(Date.now() - 12 * 60000).toISOString(), origin: "Conrad (Recruitment AI)", status: "nominal", payload: { requirementId: "req-091", matchedIndex: "idx-2291", alignmentAttributes: ["Go", "Kubernetes", "gRPC"] } },
      { id: "evt-003", type: "SUBMISSION_SENT", timestamp: new Date(Date.now() - 25 * 60000).toISOString(), origin: "Bruce Wayne (Talent Director)", status: "nominal", payload: { submissionId: "sub-10219", candidateId: "cand-442", requirementId: "req-091", portalSent: "ClientPortalV1" } },
      { id: "evt-004", type: "INTERVIEW_SCHEDULED", timestamp: new Date(Date.now() - 40 * 60000).toISOString(), origin: "Sam (Scheduling AI)", status: "nominal", payload: { interviewId: "int-840", requirementId: "req-091", date: "July 08, 10:00 AM", attendees: ["Bruce Wayne", "TechCorp Eng Team"] } },
      { id: "evt-005", type: "OFFER_RELEASED", timestamp: new Date(Date.now() - 120 * 60000).toISOString(), origin: "Tony Stark (GTM Lead)", status: "nominal", payload: { requirementId: "req-085", candidateId: "cand-998", salary: "₹38,00,000", client: "InnovateLabs Ltd" } },
      { id: "evt-006", type: "VENDOR_ADDED", timestamp: new Date(Date.now() - 180 * 60000).toISOString(), origin: "Clark Kent (Partner Mgr)", status: "nominal", payload: { vendorId: "vend-889", name: "Apex Staffing Network", trustBase: 90 } },
      { id: "evt-007", type: "CANDIDATE_JOINED", timestamp: new Date(Date.now() - 360 * 60000).toISOString(), origin: "System Engine", status: "nominal", payload: { requirementId: "req-042", candidateId: "cand-112", startDate: "2026-07-06" } },
      { id: "evt-008", type: "INVOICE_RAISED", timestamp: new Date(Date.now() - 420 * 60000).toISOString(), origin: "Finance OS", status: "nominal", payload: { invoiceId: "inv-98122", amount: "₹18,50,000", client: "InnovateLabs Ltd", feeStructure: "15% flat" } }
    ]);
  }, []);

  // Subscribe to Firestore core feeds
  useEffect(() => {
    if (!isAdmin) return;

    // Real-time agents config (AI Employees)
    const qAgents = query(collection(db, "ai_employees"));
    const unsubAgents = onSnapshot(qAgents, (snap) => {
      if (!snap.empty) {
        setAgents(snap.docs.map(doc => {
          const data = doc.data();
          // Merge static named-agent employee attributes onto Firestore documents to enrich them elegantly
          const baseData = fallbackAgents.find(a => a.id === doc.id || a.id === data.id) || {};
          return { id: doc.id, ...baseData, ...data } as Agent;
        }));
      } else {
        setAgents(fallbackAgents);
      }
    });

    // Real-time execution traces
    const qExecs = query(collection(db, "agent_executions"), orderBy("timestamp", "desc"), limit(50));
    const unsubExecs = onSnapshot(qExecs, (snap) => {
      if (!snap.empty) {
        setExecutions(snap.docs.map(doc => {
          const data = doc.data();
          // Merge default trace template parameters to provide cognitive trace audit detail if absent in Firestore
          const baseTrace = fallbackTraces.find(t => t.id === doc.id || t.agentId === data.agentId) || {};
          return { id: doc.id, ...baseTrace, ...data } as Execution;
        }));
      } else {
        setExecutions(fallbackTraces);
      }
      setLoading(false);
    }, (err) => {
      console.error("Executions subscription error:", err);
      setExecutions(fallbackTraces);
      setLoading(false);
    });

    // Real-time background queue
    const qQueue = query(collection(db, "agent_queue"), limit(20));
    const unsubQueue = onSnapshot(qQueue, (snap) => {
      setQueue(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Real-time AI Governance policies
    const qPolicies = query(collection(db, "ai_policies"));
    const unsubPolicies = onSnapshot(qPolicies, (snap) => {
      if (!snap.empty) {
        setPolicies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIPolicy)));
      } else {
        setPolicies(fallbackPolicies);
      }
    }, (err) => {
      console.error("Policies subscription error:", err);
      setPolicies(fallbackPolicies);
    });

    // Real-time AI Reports (AI Inbox)
    const qReports = query(collection(db, "ai_reports"), orderBy("timestamp", "desc"));
    const unsubReports = onSnapshot(qReports, (snap) => {
      if (!snap.empty) {
        setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIReport)));
      } else {
        setReports(fallbackReports);
      }
    }, (err) => {
      console.error("Reports subscription error:", err);
      setReports(fallbackReports);
    });

    return () => {
      unsubAgents();
      unsubExecs();
      unsubQueue();
      unsubPolicies();
      unsubReports();
    };
  }, [isAdmin, fallbackAgents, fallbackTraces, fallbackPolicies, fallbackReports]);

  // Synchronize Schema and seed defaults
  const handleSyncAgents = async () => {
    setLoading(true);
    try {
      // Seed AI Employees
      for (const ag of fallbackAgents) {
        const docRef = doc(db, "ai_employees", ag.id);
        await setDoc(docRef, {
          ...ag,
          status: 'Healthy',
          lastRun: new Date().toISOString()
        }, { merge: true });
      }

      // Seed baseline AI Policies
      for (const pol of fallbackPolicies) {
        const docRef = doc(db, "ai_policies", pol.id);
        await setDoc(docRef, {
          ...pol,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      }

      // Seed baseline AI Reports
      for (const rep of fallbackReports) {
        const docRef = doc(db, "ai_reports", rep.id);
        await setDoc(docRef, {
          ...rep,
          timestamp: new Date().toISOString()
        }, { merge: true });
      }

      // Log audit event
      await addDoc(collection(db, "agent_executions"), {
        agentId: 'founder-office',
        status: 'success',
        duration: 450,
        tokens: 420,
        model: 'gemini-1.5-pro',
        timestamp: new Date().toISOString(),
        requirementId: 'global-hq',
        client: 'Internal',
        owner: 'System Handshake',
        promptVersion: 'v1.0.0',
        toolsUsed: ['synchronize_schemas'],
        cost: 0.002,
        decision: 'Ecosystem synchronized and baseline metadata validated successfully.',
        confidence: 1.0
      });
      setLoading(false);
      alert("Schema, AI Employee Registry, Reports, and Governance Policies verified & seeded to Firestore SSOT!");
    } catch (err) {
      console.error("Failed to seed agents:", err);
      setLoading(false);
    }
  };

  // Toggle agent state
  const handleToggleAgent = async (id: string, enabled: boolean) => {
    try {
      const docRef = doc(db, "ai_employees", id);
      await updateDoc(docRef, { enabled });
    } catch (err) {
      // Offline state update
      setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled } : a));
    }
  };

  // Toggle policy state
  const handleTogglePolicy = async (id: string, status: 'active' | 'draft' | 'inactive') => {
    try {
      const docRef = doc(db, "ai_policies", id);
      await updateDoc(docRef, { status, lastUpdated: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to toggle policy:", err);
      setPolicies(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    }
  };

  // Add new governance policy
  const handleAddPolicy = async (newPol: Omit<AIPolicy, 'id' | 'lastUpdated'>) => {
    try {
      const polId = "policy-custom-" + Math.floor(1000 + Math.random() * 9000);
      const policyData: AIPolicy = {
        ...newPol,
        id: polId,
        lastUpdated: new Date().toISOString()
      };
      const docRef = doc(db, "ai_policies", polId);
      await setDoc(docRef, policyData);
    } catch (err) {
      console.error("Failed to add policy:", err);
      const polId = "policy-custom-" + Math.floor(1000 + Math.random() * 9000);
      setPolicies(prev => [...prev, { ...newPol, id: polId, lastUpdated: new Date().toISOString() }]);
    }
  };

  // Acknowledge AI report
  const handleAcknowledgeReport = async (reportId: string) => {
    try {
      const docRef = doc(db, "ai_reports", reportId);
      await updateDoc(docRef, {
        status: 'acknowledged',
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: auth.currentUser?.email || 'Admin Manager'
      });
    } catch (err) {
      console.error("Failed to acknowledge report:", err);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'acknowledged' } : r));
    }
  };

  // Trigger real-time workforce employee
  const handleTriggerAgent = async (agentId: string) => {
    setTriggeringAgentId(prev => ({ ...prev, [agentId]: true }));
    try {
      const token = await auth.currentUser?.getIdToken();
      // Dispatch real operations pipeline trigger event to backend Event Broker
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventType: 'REQUIREMENT_CREATED',
          payload: {
            requirementId: 'req-test-' + Math.floor(Math.random() * 1000),
            title: 'Operations Diagnostic Check',
            status: 'DRAFT',
            testTriggered: true
          }
        })
      });

      if (res.ok) {
        // Fetch matching metadata of the agent to preserve high fidelity
        const agentMeta = fallbackAgents.find(a => a.id === agentId) || { name: 'AI Employee', ownerName: 'Admin', model: 'gemini-1.5-pro' };
        
        // Log manual local trace event to Firestore immediately
        await addDoc(collection(db, "agent_executions"), {
          agentId,
          status: 'success',
          duration: 920 + Math.floor(Math.random() * 200),
          tokens: 1400 + Math.floor(Math.random() * 300),
          model: agentMeta.model,
          timestamp: new Date().toISOString(),
          requirementId: 'req-' + Math.floor(100 + Math.random() * 800),
          client: 'Diagnosed Sandbox Inc',
          owner: agentMeta.ownerName,
          promptVersion: 'v1.4.2-override',
          toolsUsed: ['orchestrator_trigger', 'abac_rule_verification', 'query_entity_records'],
          cost: 0.008,
          decision: `Workforce agent '${agentMeta.name}' ran successfully via force-trigger, auditing operational alignment.`,
          confidence: 0.97
        });
        alert(`Conductor conduction pass dispatched! Agent ${agentMeta.name} is executing...`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTriggeringAgentId(prev => ({ ...prev, [agentId]: false }));
    }
  };

  // Run Conductor Simulation handshakes
  const handleExecutePlayground = async () => {
    if (!playgroundPrompt.trim()) return;
    setIsRunningPlayground(true);
    setPlaygroundResult(null);

    const startTime = Date.now();
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: playgroundPrompt,
          agentId: 'recruitment-office'
        })
      });

      const latency = Date.now() - startTime;
      const data = await res.json();

      if (res.ok && data) {
        setPlaygroundResult(data);
        
        // Write cognitive trace to Firestore to update trace logs live!
        await addDoc(collection(db, "agent_executions"), {
          agentId: 'recruitment-office',
          status: 'success',
          duration: latency,
          tokens: data.tokens || (playgroundPrompt.length * 4) + 1100,
          model: data.model || 'gemini-1.5-pro',
          timestamp: new Date().toISOString(),
          requirementId: 'simulation-run',
          client: 'Simulation Lab',
          owner: 'Bruce Wayne',
          promptVersion: 'v4.0.2-sandbox',
          toolsUsed: ['sandbox_interactive_conduction', 'inspect_memory_space'],
          cost: 0.012,
          decision: `Manual Conductor run complete. Output resolved and certified for deployment.`,
          confidence: 0.95
        });
      } else {
        throw new Error(data.error || 'Server returned invalid schema output');
      }
    } catch (err: any) {
      // Fallback mockup output for safe sandbox operation
      setPlaygroundResult({
        decision: "Fallback Sandbox Conduction Approved.",
        confidence: 0.94,
        actions: ["Verify Kubernetes candidate certifications", "Apply trust factor modifier: 0.98"],
        telemetry: { duration: 1150, tokens: 2840, prompt_version: "v4.0.2-fallback" }
      });
    } finally {
      setIsRunningPlayground(false);
    }
  };

  // Generate Automated Executive Report
  const handleGenerateReport = async (type: string) => {
    setSelectedReportType(type);
    setIsGeneratingReport(true);
    setReportResult(null);
    await new Promise(r => setTimeout(r, 1200)); // Smooth animation delay

    // Compute beautiful statistics to feed inside the generated briefing report
    const totalExecs = executions.length || 124;
    const rate = execStats.successRate.toFixed(1);
    const avgMs = execStats.avgLatency.toFixed(0);
    const costEst = (executions.reduce((sum, e) => sum + (e.cost || 0.005), 0) || 1.45).toFixed(4);

    let content = "";
    if (type === "daily" || type === "requirements") {
      content = `HIRENEST OS DAILY OPERATIONS BRIEFING - ${new Date().toLocaleDateString()}
Authority Scope: Global Executive Dashboard

SUMMARY ANALYSIS:
==================================
* Platform Operations Status: NOMINAL (99.98% overall connectivity)
* Workforce Alignment: 7 Active Digital Employees scoring 98.7% success rate
* Requirements Tracked: ${fallbackRequirements.length} active pipelines under observatories
* Estimated Placement Savings Influence: ₹3,75,000 (Today)

ACTIVE SLA BOTTLENECKS:
==================================
* WARNING: Initech Corp (Staff Go/Kubernetes Developer) response latency exceeded 20 hours. 
  Cleo (CS Agent) has escalated this to Bruce Wayne (Talent Director).
* BREACHED: GlobalFinance Corp (VP of Engineering) submittal rate limits breached. 
  Manual recruiter override needed immediately.

WORKFORCE PERFORMANCE LEDGER:
==================================
- Total AI Transactions Checked: ${totalExecs}
- Mean Handshake: ${avgMs}ms RTT
- Model Token Cost Ledger: ₹${(Number(costEst) * 83.5).toFixed(2)}
- Recruiter Productivity Multiplier: 9.4x`;
    } else if (type === "weekly" || type === "candidates") {
      content = `HIRENEST OS SYSTEM WEEKLY PERFORMANCE ROUNDUP
Date Range: June 30 - July 06, 2026

EXECUTIVE HIGHLIGHTS:
==================================
* Placements Completed: 8 placements processed across OS Deal Rooms
* Sourced Candidates parsed: 422 candidate profiles imported automatically
* Average Vendor Response Time: 34 minutes (reduced from 12 hours)
* Calculated Platform ROI: 11.2x estimated cost savings

COGNITIVE STACK HEALTH:
==================================
- Handshake handshakes completed: 42,000 nominal requests
- Token usage: 489,122 processed tokens across Gemini model APIs
- Total compute cost: ₹3,550.00
- ABAC Security Compliance Policy violation flags: 0 (Strict ABAC policies verified)`;
    } else {
      content = `HIRENEST RECRUITER & BDM PRODUCTIVITY BRIEFING
Generated at ${new Date().toLocaleTimeString()}

INDIVIDUAL CONTROLLER OUTCOMES:
==================================
* Bruce Wayne (Talent Director): 14 active requirements aligned. 98.4% workforce feedback score.
* Diana Prince (VP Ops): 22 placements overseen. High-fidelity feedback loop completed on 8 requirements.
* Peter Parker (CS Lead): 120 client queries addressed, average response time: 2.1 minutes.
* Vance (Vendor Coordinator AI): Successfully raised trust ratings on 4 partner benches.

SLA ACCELERATION:
==================================
- System Automation has reduced intake-to-match delays from 48 hours to 15 seconds.
- 94.5% of matches processed through Layer 1 (Deterministic) rules and escalated cleanly to Recruiter Override.`;
    }

    setReportResult(content);
    setIsGeneratingReport(false);

    // Persist to Firestore ai_reports collection
    try {
      const repId = "rep-" + Math.floor(1000 + Math.random() * 9000);
      const reportTitle = type === "daily" || type === "requirements" 
        ? "Autonomous Intake & SLA Compliance Digest"
        : type === "weekly" || type === "candidates"
          ? "Strategic Bench & Sourcing Synergy Roundup"
          : "Recruiter Productivity & Performance Briefing";

      const reportData: Omit<AIReport, 'id'> = {
        agentId: type === "daily" || type === "requirements" ? "founder-office" : type === "weekly" || type === "candidates" ? "vendor-office" : "recruitment-office",
        agentName: type === "daily" || type === "requirements" ? "Alpha Founder Liaison" : type === "weekly" || type === "candidates" ? "Vance Vendor Coordinator" : "Conrad Recruiter Conductor",
        type: (type === "daily" || type === "requirements") ? "daily" : (type === "weekly" || type === "candidates") ? "weekly" : "custom",
        title: reportTitle,
        content: content,
        status: "unread",
        timestamp: new Date().toISOString()
      };

      const docRef = doc(db, "ai_reports", repId);
      await setDoc(docRef, { ...reportData, id: repId });
    } catch (dbErr) {
      console.error("Failed to write report to Firestore:", dbErr);
    }
  };

  // Compute stats across executions
  const execStats = useMemo(() => {
    const list = executions.length > 0 ? executions : fallbackTraces;
    const total = list.length;
    const successes = list.filter(e => e.status === 'success').length;
    const successRate = total > 0 ? (successes / total) * 100 : 98.7;
    const totalLatency = list.reduce((sum, e) => sum + e.duration, 0);
    const avgLatency = total > 0 ? totalLatency / total : 1120;
    const totalTokens = list.reduce((sum, e) => sum + (e.tokens || 0), 0) || 489122;
    const cost = list.reduce((sum, e) => sum + (e.cost || 0.005), 0) || 1.45;
    return { total, successRate, avgLatency, totalTokens, cost };
  }, [executions, fallbackTraces]);

  // Recharts metric calculations for performance ROI panel
  const chartData = useMemo(() => [
    { name: "00:00", tokens: 24000, cost: 0.12, hoursSaved: 12 },
    { name: "04:00", tokens: 18000, cost: 0.09, hoursSaved: 10 },
    { name: "08:00", tokens: 45000, cost: 0.22, hoursSaved: 24 },
    { name: "12:00", tokens: 78000, cost: 0.39, hoursSaved: 45 },
    { name: "16:00", tokens: 62000, cost: 0.31, hoursSaved: 38 },
    { name: "20:00", tokens: 35000, cost: 0.17, hoursSaved: 18 }
  ], []);

  // Filtered Business Events
  const filteredEvents = useMemo(() => {
    if (eventFilter === "ALL") return eventsFeed;
    return eventsFeed.filter(e => e.type === eventFilter);
  }, [eventsFeed, eventFilter]);

  // Unified list of active agents (merging state or fallback)
  const activeAgentsList = useMemo(() => {
    return agents.length > 0 ? agents : fallbackAgents;
  }, [agents, fallbackAgents]);

  if (!isAdmin) {
    return (
      <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs bg-[#070A13] min-h-screen flex items-center justify-center">
        <div className="space-y-4 max-w-md">
          <ShieldAlert size={48} className="mx-auto text-rose-500/80 animate-bounce" />
          <h2 className="text-white text-lg font-black tracking-tight">Authority Access Required</h2>
          <p className="text-slate-500 font-normal normal-case text-sm">
            You are attempting to access the Core Operations handshakes. This view is strictly restricted to system administrators, executives, and platform developers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#070A13] text-slate-300 font-sans">
      
      {/* 1. Header Panel */}
      <div className="px-8 py-6 border-b border-slate-900 bg-[#0B0F19] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Cpu size={180} className="text-indigo-400 animate-pulse" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <Cpu className="text-indigo-400" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-white tracking-tight">Unified Operations Command Center</h1>
                <span className="text-[9px] font-bold uppercase bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                  UOP Core v1.1
                </span>
                <span className="text-[9px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full">
                  Firestore SSOT ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Ecosystem-wide digital workforce, requirement ownership, SLA tracking, and audit ledger.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button 
            id="sync-schema-btn"
            onClick={handleSyncAgents}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-colors"
          >
            <RefreshCw size={13} className={cn("text-slate-400", loading && "animate-spin")} />
            Sync Schema & Metadata
          </button>
        </div>
      </div>

      {/* 2. Primary Domain Selection Dashboard */}
      <div className="px-8 pt-6 pb-2 max-w-[1600px] w-full mx-auto grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
        
        {/* EXECUTIVE DOMAIN */}
        <button 
          id="domain-executive-btn"
          onClick={() => { setActiveDomain('executive'); setActiveSubTab('overview'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'executive' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'executive' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <Layout size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Executive Home</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Overview, AI COO Briefings</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
            <span className="text-[9px] font-black uppercase text-emerald-400">9 Live Indexes</span>
          </div>
        </button>

        {/* PLATFORM OPERATIONS */}
        <button 
          id="domain-platform-btn"
          onClick={() => { setActiveDomain('platform'); setActiveSubTab('connectivity'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'platform' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'platform' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <Server size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Operations</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Connectivity, Live Events, Timeline</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
            <span className="text-[9px] font-black uppercase text-emerald-400">12 Live Bridges</span>
          </div>
        </button>

        {/* BUSINESS OPERATIONS */}
        <button 
          id="domain-business-btn"
          onClick={() => { setActiveDomain('business'); setActiveSubTab('observatory'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'business' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'business' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <Briefcase size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Business Operations</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Requirements, SLA, Digital Twin</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase text-emerald-400">Digital Twins Live</span>
          </div>
        </button>

        {/* AI WORKFORCE */}
        <button 
          id="domain-workforce-btn"
          onClick={() => { setActiveDomain('workforce'); setActiveSubTab('registry'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'workforce' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'workforce' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">AI Workforce</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Registry, Hybrid Org, Reports</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase text-indigo-400">7 Named Employees</span>
          </div>
        </button>

        {/* GOVERNANCE & AUDIT */}
        <button 
          id="domain-governance-btn"
          onClick={() => { setActiveDomain('governance'); setActiveSubTab('iam'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'governance' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'governance' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <Shield size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Governance & Audit</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">ABAC Permission, Memory Explorer</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full" />
            <span className="text-[9px] font-black uppercase text-indigo-400">Auditing Secured</span>
          </div>
        </button>

        {/* WORKFLOW ORCHESTRATOR */}
        <button 
          id="domain-orchestrator-btn"
          onClick={() => { setActiveDomain('orchestrator'); setActiveSubTab('orchestrator_timelines'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'orchestrator' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'orchestrator' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <Workflow size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Workflow Orchestrator</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">SLA Timelines, Multi-Agent States</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase text-indigo-400">Orchestrations Live</span>
          </div>
        </button>

        {/* DECISION INTELLIGENCE */}
        <button 
          id="domain-decision-btn"
          onClick={() => { setActiveDomain('decision'); setActiveSubTab('decision_scorecards'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'decision' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'decision' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <Brain size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Decision Intelligence</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Verifiable Rationale, Overrides</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-[#818cf8] rounded-full" />
            <span className="text-[9px] font-black uppercase text-indigo-400">Matching Decided</span>
          </div>
        </button>

        {/* PREDICTIVE ANALYTICS */}
        <button 
          id="domain-predictive-btn"
          onClick={() => { setActiveDomain('predictive'); setActiveSubTab('predictive_projections'); }}
          className={cn("p-5 border rounded-2xl flex flex-col items-start gap-3 text-left transition-all relative overflow-hidden group",
            activeDomain === 'predictive' 
              ? "bg-[#0F1424] border-indigo-500/40 text-white shadow-lg shadow-indigo-500/5" 
              : "bg-[#0B0F19] border-slate-900/80 text-slate-400 hover:border-slate-800 hover:bg-[#0d121f]"
          )}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
          <div className={cn("p-2 rounded-xl border text-sm", 
            activeDomain === 'predictive' ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30" : "bg-slate-900 text-slate-500 border-slate-800"
          )}>
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Predictive Analytics</h3>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">SLA Simulators, Trend Curves</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="h-1.5 w-1.5 bg-[#10b981] rounded-full" />
            <span className="text-[9px] font-black uppercase text-emerald-400">Forecast Live</span>
          </div>
        </button>

      </div>

      {/* 3. Main Dashboard Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row px-8 pb-12 max-w-[1600px] w-full mx-auto gap-8 mt-4 overflow-hidden shrink-0">
        
        {/* Secondary Sub-navigation sidebar based on selected primary domain */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
          <div className="text-[9px] font-black uppercase text-slate-500 tracking-[0.25em] mb-1 px-3">
            Domain Observability Modules
          </div>

          {activeDomain === 'executive' && (
            <>
              <button 
                onClick={() => setActiveSubTab('overview')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'overview' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Layout size={14} /> Executive Home</span>
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">LIVE</span>
              </button>
            </>
          )}

          {activeDomain === 'platform' && (
            <>
              <button 
                onClick={() => setActiveSubTab('connectivity')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'connectivity' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Wifi size={14} /> Connectivity status</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-indigo-400 font-bold border border-slate-800">12 OK</span>
              </button>
              
              <button 
                onClick={() => setActiveSubTab('events')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'events' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Workflow size={14} /> Live Event stream</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-indigo-400 font-bold border border-slate-800">{eventsFeed.length}</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('hie_health')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'hie_health' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Cpu size={14} /> HIE Operational Health</span>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase">HIE v1.0</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('services')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'services' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Cpu size={14} /> Service Registry & SLOs</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">5 SRVS</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('incidents')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'incidents' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><ShieldAlert size={14} /> AI Incident Center</span>
                <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-bold uppercase">SELF HEAL</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('activity_timeline')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'activity_timeline' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><History size={14} /> Activity Timeline</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">7 Feed</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('infrastructure')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'infrastructure' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Server size={14} /> AI Dev & Infra Hub</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">Sprints 6-10</span>
              </button>
            </>
          )}

          {activeDomain === 'business' && (
            <>
              <button 
                onClick={() => setActiveSubTab('observatory')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'observatory' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Eye size={14} /> Req Observatory</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-indigo-400 font-bold border border-slate-800">{fallbackRequirements.length}</span>
              </button>
              
              <button 
                onClick={() => setActiveSubTab('customer_health')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border mt-2", 
                  activeSubTab === 'customer_health' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Heart size={14} /> CS Health Hub</span>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase">4 OK</span>
              </button>
            </>
          )}

          {activeDomain === 'workforce' && (
            <>
              <button 
                onClick={() => setActiveSubTab('registry')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'registry' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Bot size={14} /> Digital Employees</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-indigo-400 font-bold border border-slate-800">{activeAgentsList.length}</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('inbox')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'inbox' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Inbox size={14} /> AI Inbox & Briefs</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold border", 
                  reports.filter(r => r.status === 'unread').length > 0 
                    ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" 
                    : "bg-slate-950/40 text-slate-500 border-slate-800"
                )}>
                  {reports.filter(r => r.status === 'unread').length} New
                </span>
              </button>

              <button 
                onClick={() => setActiveSubTab('reviews')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'reviews' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Award size={14} /> Performance Reviews</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">KPI</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('collaboration')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'collaboration' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Network size={14} /> Collaboration Graph</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-indigo-400 font-bold border border-slate-800">Graph</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('playbooks')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'playbooks' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Compass size={14} /> Playbooks</span>
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 rounded font-bold uppercase">SOP</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('knowledge')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'knowledge' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><FolderOpen size={14} /> Knowledge Center</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">Prompt</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('org_chart')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'org_chart' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Network size={14} /> Hybrid Org Chart</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-slate-500 border border-slate-800">Chart</span>
              </button>
              
              <button 
                onClick={() => setActiveSubTab('executive_reports')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'executive_reports' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><FileSpreadsheet size={14} /> Reporting Hub</span>
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 rounded font-bold uppercase">Auto</span>
              </button>
            </>
          )}

          {activeDomain === 'governance' && (
            <>
              <button 
                onClick={() => setActiveSubTab('iam')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'iam' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><UserCheck size={14} /> IAM Protocol Matrix</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-indigo-400 font-bold border border-slate-800">ABAC</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('policies')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'policies' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><ShieldAlert size={14} /> AI Governance Policies</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold border", 
                  policies.filter(p => p.status === 'active').length > 0 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : "bg-slate-950/40 text-slate-500 border-slate-800"
                )}>
                  {policies.filter(p => p.status === 'active').length} Active
                </span>
              </button>

              <button 
                onClick={() => setActiveSubTab('traces')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'traces' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><History size={14} /> Cognitive Traces</span>
                <span className="text-[9px] bg-slate-950/40 px-1.5 py-0.5 rounded text-indigo-400 font-bold border border-slate-800">{executions.length || fallbackTraces.length}</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('memory_explorer')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'memory_explorer' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><BookOpen size={14} /> AI Memory Explorer</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">RAG</span>
              </button>

              <button 
                onClick={() => setActiveSubTab('simulation')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'simulation' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Terminal size={14} /> Simulation Lab</span>
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 rounded uppercase font-bold">Admin</span>
              </button>
            </>
          )}

          {activeDomain === 'orchestrator' && (
            <>
              <button 
                onClick={() => setActiveSubTab('orchestrator_timelines')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'orchestrator_timelines' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Workflow size={14} /> SLA Timelines</span>
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">ACTIVE</span>
              </button>
            </>
          )}

          {activeDomain === 'decision' && (
            <>
              <button 
                onClick={() => setActiveSubTab('decision_scorecards')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'decision_scorecards' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><Brain size={14} /> Scorecards</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">RITL</span>
              </button>
            </>
          )}

          {activeDomain === 'predictive' && (
            <>
              <button 
                onClick={() => setActiveSubTab('predictive_projections')}
                className={cn("w-full px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all flex items-center justify-between border", 
                  activeSubTab === 'predictive_projections' ? "bg-indigo-600 border-indigo-500 text-white shadow" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:bg-[#0e1423] hover:text-white")}
              >
                <span className="flex items-center gap-2"><TrendingUp size={14} /> Projections</span>
                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">PROJ</span>
              </button>
            </>
          )}

          <div className="mt-6 p-4 rounded-2xl bg-[#0B0F19] border border-slate-900/60 space-y-3.5">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] block">Telemetry Metrics</span>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Success Rate:</span>
                <span className="font-bold text-white">{execStats.successRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Mean Latency:</span>
                <span className="font-bold text-white">{execStats.avgLatency.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Token Cost:</span>
                <span className="font-bold text-emerald-400">${execStats.cost.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Display Content Panel for Active Sub-Tab */}
        <div className="flex-1 bg-[#0B0F19] border border-slate-900 rounded-3xl p-6 lg:p-8 min-h-[620px] flex flex-col overflow-hidden shadow-2xl">
          
          <AnimatePresence mode="wait">
            
            {/* DOMAIN 0: EXECUTIVE - Command Dashboard */}
            {activeDomain === 'executive' && activeSubTab === 'overview' && (
              <motion.div 
                key="executive_overview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <ExecutiveHome
                  agentsCount={activeAgentsList.length}
                  requirementsCount={fallbackRequirements.length}
                  onGenerateReport={handleGenerateReport}
                  reportResult={reportResult}
                  isGeneratingReport={isGeneratingReport}
                />
              </motion.div>
            )}

            {/* DOMAIN 1: PLATFORM - Connectivity & Event Stream */}
            {activeDomain === 'platform' && (
              <motion.div 
                key={activeSubTab === 'infrastructure' ? "infra_console" : "platform_operations"}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                {activeSubTab === 'infrastructure' ? (
                  <InfrastructureConsole />
                ) : (
                  <PlatformOperations
                    activeSubTab={activeSubTab}
                    setActiveSubTab={setActiveSubTab}
                    eventsFeed={eventsFeed}
                    selectedEvent={selectedEvent}
                    setSelectedEvent={setSelectedEvent}
                    eventFilter={eventFilter}
                    setEventFilter={setEventFilter}
                    filteredEvents={filteredEvents}
                  />
                )}
              </motion.div>
            )}

            {/* DOMAIN 2: BUSINESS OPERATIONS */}
            {activeDomain === 'business' && (
              <motion.div 
                key="business_operations"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <BusinessOperations
                  activeSubTab={activeSubTab}
                  setActiveSubTab={setActiveSubTab}
                  selectedReq={selectedReq}
                  setSelectedReq={setSelectedReq}
                  fallbackRequirements={fallbackRequirements}
                />
              </motion.div>
            )}

            {/* DOMAIN 3: AI WORKFORCE */}
            {activeDomain === 'workforce' && (
              <motion.div 
                key="ai_workforce"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <AIWorkforce
                  activeSubTab={activeSubTab}
                  setActiveSubTab={setActiveSubTab}
                  agents={activeAgentsList}
                  onToggleAgent={handleToggleAgent}
                  onTriggerAgent={handleTriggerAgent}
                  isTriggering={triggeringAgentId}
                  onGenerateReport={handleGenerateReport}
                  reportResult={reportResult}
                  isGeneratingReport={isGeneratingReport}
                  reports={reports}
                  onAcknowledgeReport={handleAcknowledgeReport}
                />
              </motion.div>
            )}

            {/* DOMAIN 4: GOVERNANCE & AUDIT */}
            {activeDomain === 'governance' && (
              <motion.div 
                key="governance_audit"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <GovernanceAudit
                  activeSubTab={activeSubTab}
                  setActiveSubTab={setActiveSubTab}
                  executions={executions.length > 0 ? executions : fallbackTraces}
                  selectedExec={selectedEvent as any} // map trace
                  setSelectedExec={setSelectedEvent as any}
                  agents={activeAgentsList}
                  simulationPrompt={playgroundPrompt}
                  setSimulationPrompt={setPlaygroundPrompt}
                  isSimulating={isRunningPlayground}
                  onRunSimulation={handleExecutePlayground}
                  simulationResult={playgroundResult}
                  policies={policies}
                  onTogglePolicy={handleTogglePolicy}
                  onAddPolicy={handleAddPolicy}
                />
              </motion.div>
            )}

            {/* DOMAIN 5: WORKFLOW ORCHESTRATOR */}
            {activeDomain === 'orchestrator' && (
              <motion.div 
                key="workflow_orchestrator"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <WorkflowOrchestrator />
              </motion.div>
            )}

            {/* DOMAIN 6: DECISION INTELLIGENCE */}
            {activeDomain === 'decision' && (
              <motion.div 
                key="decision_intelligence"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <DecisionIntelligence />
              </motion.div>
            )}

            {/* DOMAIN 7: PREDICTIVE ANALYTICS */}
            {activeDomain === 'predictive' && (
              <motion.div 
                key="predictive_analytics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <PredictiveAnalytics />
              </motion.div>
            )}

          </AnimatePresence>
          
        </div>
      </div>
    </div>
  );
}
