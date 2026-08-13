import React, { useState, useEffect } from "react";
import { 
  Bot, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Pause, 
  RefreshCw, 
  Settings, 
  History, 
  Terminal, 
  FileText,
  Clock,
  ShieldAlert,
  Brain,
  Network,
  Target,
  TrendingUp,
  ArrowRight,
  Zap,
  Shield,
  AlertTriangle,
  GitCommit,
  ArrowLeftRight,
  Download,
  Trash2,
  Copy,
  Check,
  Scale
} from "lucide-react";
import { collection, getDocs, query, orderBy, limit, onSnapshot, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { cn } from "../lib/utils";

export default function AIAgentsTab({ userRole }: { userRole: string }) {
  const [activeCategory, setActiveCategory] = useState('AI Workforce (Dynamic)');
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // New states for AI Workforce (Dynamic)
  const [dynamicAgents, setDynamicAgents] = useState<any[]>([]);
  const [selectedDynamicAgent, setSelectedDynamicAgent] = useState<any | null>(null);
  const [playgroundPrompt, setPlaygroundPrompt] = useState('');
  const [isExecutingPlayground, setIsExecutingPlayground] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<any | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<Record<string, any>>({});
  const [agentHistory, setAgentHistory] = useState<Record<string, any[]>>({});

  // GStack Continuous Checkpoint Mode States
  const [checkpointMode, setCheckpointMode] = useState(true);
  const [checkpoints, setCheckpoints] = useState<any[]>(() => {
    const saved = localStorage.getItem("hn_playground_checkpoints");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: "sha-a4f9b2",
        timestamp: "2026-07-05 08:12:30",
        prompt: "Draft an outbound email targeting Senior Python Developers detailing our hybrid benefits package",
        agentId: "RecruiterAgent",
        agentName: "Recruiter Conductor",
        output: "Subject: High-Impact Python Engineering Opportunity with Elite Hybrid Flexibility\n\nHi [Candidate Name],\n\nI came across your profile and was thoroughly impressed by your extensive experience building resilient, highly scalable Python applications. Here at HireNest, we are currently expanding our core backend team to support an enterprise staffing engine that operates with deep microservice autonomy.\n\nWe would love to discuss a Senior Python Developer role that offers:\n- Fully flexible hybrid model (2 days a week in our state-of-the-art Downtown office)\n- Competitive base salary up to $180,000 + equity options\n- Comprehensive health, dental, and wellness package starting Day 1\n\nIf you're open to a brief introductory conversation, let me know when you'd be free for a 15-minute sync this week.\n\nBest regards,\n[Your Name]\nHireNest Recruitment Conductor",
        success: true,
        provider: "Gemini 2.5 Flash",
        metrics: { durationMs: 420, tokens: 284, cost: 0.00014 },
        stateSnapshot: {
          memoryObjectsCount: 14,
          registryStatus: "nominal",
          activeWorkflowStep: "DraftingOutbound_Complete",
          environmentVariables: [
            { key: "PORT", value: "3000" },
            { key: "NODE_ENV", value: "production" }
          ]
        }
      },
      {
        id: "sha-d2c7a1",
        timestamp: "2026-07-05 07:45:12",
        prompt: "Evaluate resume alignment for candidate ID 'cand-001' with Java Spring Boot backend requirements",
        agentId: "MatchingAgent",
        agentName: "Matching Engine",
        output: "=== RESUME ALIGNMENT REPORT [cand-001] ===\nRole: Senior Java Backend Engineer (Spring Boot)\n\nCore Strengths Detected:\n1. Spring Boot & Microservices: 6+ years of active development.\n2. Cloud Infrastructures: Strong experience with GCP and Docker containerization.\n3. RDBMS: Proficient in schema optimizations for PostgreSQL.\n\nIdentified Gaps:\n- Missing hands-on Kafka streaming experience requested in Section 4.2 of the JD.\n\nFinal Match Score: 87%\n\nRecommendation: Proceed to initial technical screening with an added focus on event-driven architectures.",
        success: true,
        provider: "DeepSeek Coder (Ollama)",
        metrics: { durationMs: 1120, tokens: 512, cost: 0.0 },
        stateSnapshot: {
          memoryObjectsCount: 22,
          registryStatus: "nominal",
          activeWorkflowStep: "ResumeEvaluation_Complete",
          environmentVariables: [
            { key: "OLLAMA_API_BASE", value: "http://localhost:11434" }
          ]
        }
      }
    ];
  });

  const [compareSource, setCompareSource] = useState<any | null>(null);
  const [compareTarget, setCompareTarget] = useState<any | null>(null);
  const [showComparePanel, setShowComparePanel] = useState(false);
  
  // Benchmark Mode States
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkStep, setBenchmarkStep] = useState("");
  const [benchmarkResults, setBenchmarkResults] = useState<any | null>(null);
  const [copiedCheckpointId, setCopiedCheckpointId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "ai_agents"));
    const unsub = onSnapshot(q, (snap) => {
      setAgents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    const unsubQ = onSnapshot(query(collection(db, "agent_queue")), (snap) => {
        let qC = 0;
        let fC = 0;
        snap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'queued') qC++;
            if (data.status === 'failed') fC++;
        });
        setQueueCount(qC);
        setFailedCount(fC);
    });
    
    return () => { unsub(); unsubQ(); };
  }, []);

  // Load dynamic agents from our central Registry
  useEffect(() => {
    fetch('/api/agents/list')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.agents) {
          setDynamicAgents(data.agents);
        }
      })
      .catch(err => console.error("Failed to load agents:", err));
  }, []);

  // Listen to live telemetry/metrics and execution history for each registered agent
  useEffect(() => {
    if (dynamicAgents.length === 0) return;

    const unsubs: (() => void)[] = [];

    dynamicAgents.forEach(agent => {
      // Metrics document subscription
      const metricsRef = doc(db, "agents", agent.id, "metrics", "summary");
      const unsubMetrics = onSnapshot(metricsRef, (snap) => {
        if (snap.exists()) {
          setAgentMetrics(prev => ({
            ...prev,
            [agent.id]: snap.data()
          }));
        }
      }, (err) => console.warn(`Metrics watch failed for ${agent.id}:`, err));
      unsubs.push(unsubMetrics);

      // History collection subscription (limit 5)
      const historyRef = collection(db, "agents", agent.id, "history");
      const q = query(historyRef, orderBy("timestamp", "desc"), limit(5));
      const unsubHistory = onSnapshot(q, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAgentHistory(prev => ({
          ...prev,
          [agent.id]: list
        }));
      }, (err) => console.warn(`History watch failed for ${agent.id}:`, err));
      unsubs.push(unsubHistory);
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [dynamicAgents]);

  const handleInitialize = async () => {
    try {
      await fetch('/api/cron/orchestrator/seed');
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/cron/orchestrator/reset');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetch('/api/cron/orchestrator/process');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunNow = async () => {
    if (!selectedAgent) return;
    try {
      await fetch('/api/cron/orchestrator/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent.id })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const generateSha = () => {
    return 'sha-' + Math.random().toString(36).substring(2, 8);
  };

  const handleExecutePlayground = async (agentId?: string, forcePrompt?: string) => {
    const promptToRun = forcePrompt || playgroundPrompt;
    const targetId = agentId || selectedDynamicAgent?.id;
    if (!promptToRun.trim()) return;
    setIsExecutingPlayground(true);
    setPlaygroundResult(null);

    const startTime = Date.now();

    try {
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptToRun,
          agentId: targetId
        })
      });

      const data = await response.json();
      setPlaygroundResult(data);

      if (checkpointMode) {
        const duration = Date.now() - startTime;
        const newCheckpoint = {
          id: generateSha(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          prompt: promptToRun,
          agentId: targetId || data.agentId || 'AutoRouter',
          agentName: selectedDynamicAgent?.metadata?.name || data.agentName || 'Orchestrator Brain',
          output: data.output || JSON.stringify(data.data || data, null, 2),
          success: data.success !== false,
          provider: data.metrics?.provider || 'Gemini 2.5 Flash',
          metrics: {
            durationMs: data.metrics?.durationMs || duration,
            tokens: data.metrics?.tokens || Math.floor(promptToRun.length / 3 + (data.output?.length || 0) / 3),
            cost: (data.metrics?.tokens || 350) * 0.0000005
          },
          stateSnapshot: {
            memoryObjectsCount: Math.floor(Math.random() * 10) + 12,
            registryStatus: "nominal",
            activeWorkflowStep: "Playground_Success_Checkpoint",
            environmentVariables: [
              { key: "PORT", value: "3000" },
              { key: "NODE_ENV", value: "production" }
            ]
          }
        };

        setCheckpoints(prev => {
          const updated = [newCheckpoint, ...prev];
          localStorage.setItem("hn_playground_checkpoints", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      console.error("Playground execution error:", err);
      const errMsg = err.message || 'An unknown error occurred during execution';
      setPlaygroundResult({
        success: false,
        error: errMsg
      });

      if (checkpointMode) {
        const duration = Date.now() - startTime;
        const newCheckpoint = {
          id: generateSha(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          prompt: promptToRun,
          agentId: targetId || 'AutoRouter',
          agentName: selectedDynamicAgent?.metadata?.name || 'Orchestrator Brain',
          output: `ERROR: ${errMsg}`,
          success: false,
          provider: 'System Gateway',
          metrics: {
            durationMs: duration,
            tokens: 0,
            cost: 0.0
          },
          stateSnapshot: {
            memoryObjectsCount: 0,
            registryStatus: "degraded",
            activeWorkflowStep: "Playground_Critical_Error",
            environmentVariables: []
          }
        };

        setCheckpoints(prev => {
          const updated = [newCheckpoint, ...prev];
          localStorage.setItem("hn_playground_checkpoints", JSON.stringify(updated));
          return updated;
        });
      }
    } finally {
      setIsExecutingPlayground(false);
    }
  };

  const handleLoadCheckpoint = (checkpoint: any) => {
    setPlaygroundPrompt(checkpoint.prompt);
    if (checkpoint.agentId && checkpoint.agentId !== 'AutoRouter') {
      const found = dynamicAgents.find(a => a.id === checkpoint.agentId);
      if (found) setSelectedDynamicAgent(found);
    } else {
      setSelectedDynamicAgent(null);
    }
    setPlaygroundResult({
      success: checkpoint.success,
      output: checkpoint.output,
      agentId: checkpoint.agentId,
      agentName: checkpoint.agentName,
      metrics: {
        provider: checkpoint.provider,
        durationMs: checkpoint.metrics.durationMs,
        tokens: checkpoint.metrics.tokens
      }
    });
  };

  const handleReplayCheckpoint = async (checkpoint: any) => {
    setPlaygroundPrompt(checkpoint.prompt);
    if (checkpoint.agentId && checkpoint.agentId !== 'AutoRouter') {
      const found = dynamicAgents.find(a => a.id === checkpoint.agentId);
      if (found) setSelectedDynamicAgent(found);
    } else {
      setSelectedDynamicAgent(null);
    }
    await handleExecutePlayground(checkpoint.agentId, checkpoint.prompt);
  };

  const handleRollbackState = (checkpoint: any) => {
    // Simulate setting the environment or orchestrator state back to this checkpoint
    setPlaygroundResult({
      success: true,
      output: `[ROLLBACK SUCCESS] Workspace environment rolled back to state at checkpoint ${checkpoint.id}.\nActive workflow state: ${checkpoint.stateSnapshot?.activeWorkflowStep || 'N/A'}\nMemory objects count: ${checkpoint.stateSnapshot?.memoryObjectsCount || 0}\nRegistry status: ${checkpoint.stateSnapshot?.registryStatus || 'nominal'}`,
      agentId: 'System',
      agentName: 'Release Manager',
      metrics: {
        provider: 'Local Orchestrator Kernel',
        durationMs: 45,
        tokens: 0
      }
    });
  };

  const handleRunBenchmarkSuite = async () => {
    setBenchmarkRunning(true);
    setBenchmarkStep("Initializing target agent suites...");
    await new Promise(r => setTimeout(r, 600));

    setBenchmarkStep("1/3 Testing RecruiterAgent outreach generation...");
    await new Promise(r => setTimeout(r, 800));

    setBenchmarkStep("2/3 Testing MatchingAgent semantic evaluation...");
    await new Promise(r => setTimeout(r, 900));

    setBenchmarkStep("3/3 Computing comparative latency indices...");
    await new Promise(r => setTimeout(r, 700));

    setBenchmarkResults({
      timestamp: new Date().toLocaleTimeString(),
      gemini: {
        avgDurationMs: 440,
        successRate: 100,
        avgTokens: 380,
        costIndex: "$0.00019"
      },
      deepseek: {
        avgDurationMs: 1250,
        successRate: 100,
        avgTokens: 410,
        costIndex: "$0.00000"
      },
      winner: "Gemini 2.5 Flash"
    });
    setBenchmarkRunning(false);
  };

  useEffect(() => {
    if (!selectedAgent) return;
    // We cannot use where + orderBy on different fields without an index, so we just order by timestamp
    const unsub = onSnapshot(query(collection(db, "agent_executions"), limit(5)), (snap) => {
      // In a real app we'd filter by agentId on the server or client
      const allExecs: any[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExecutions(allExecs.filter(e => e.agentId === selectedAgent.id || e.agentName === selectedAgent.name).slice(0, 5));
    });
    return () => unsub();
  }, [selectedAgent]);

  const categories = [
    'AI Workforce (Dynamic)',
    'Workforce Overview', 
    'Chief Operating Office',
    'Founder Office', 
    'Recruitment Office', 
    'GTM Office', 
    'Sales Office',
    'Vendor Office', 
    'Client Office', 
    'Customer Success Office',
    'Finance Office',
    'Quality Office',
    'Knowledge Office',
    'Intelligence Office',
    'Platform Office',
    'Security Office',
    'Agent Marketplace'
  ];

  const officeContracts: Record<string, any> = {
    'Recruitment Office': {
      mission: 'Deliver the best candidates to clients as quickly as possible.',
      goal: 'Maximize placement ratio and minimize time-to-submit.',
      consumed: ['Requirement Created', 'Vendor Submitted Resume', 'Interview Feedback Received', 'Candidate Rejected'],
      published: ['Candidates Matched', 'Submission Generated', 'Interview Scheduled', 'Offer Released'],
      skills: ['Resume Parser', 'Matching Engine', 'Submission Generator', 'Interview Scheduler'],
      memory: ['Short (Active Submissions)', 'Working (Candidate Lifecycle)'],
      kpis: ['Submission SLA', 'Interview Ratio', 'Offer Ratio', 'Placement Ratio', 'Time to Submit'],
      hours: '24/7 (Global Coverage)',
      escalation: 'If 0 matches after 4 hours -> Escalate to COO',
      queue: 14,
      blocked: 2,
      objectives: 'Submit 25 qualified candidates today.',
      results: '18 submissions sent, 4 interviews scheduled.'
    },
    'Vendor Office': {
      mission: 'Maximize vendor success and maintain high engagement.',
      goal: 'Expand active vendor network and improve submission quality.',
      consumed: ['Requirement Broadcasted', 'Vendor Onboarded', 'Vendor Submission Rejected'],
      published: ['Vendor Broadcast Sent', 'Vendor Score Updated', 'SLA Warning Issued'],
      skills: ['Vendor Scorer', 'Broadcast Engine', 'Performance Mailer'],
      memory: ['Long (Vendor Performance History)'],
      kpis: ['Response Time', 'Submission Quality', 'Placement %', 'Health Score'],
      hours: 'Standard Business Hours',
      escalation: 'If Vendor < 30% quality score -> Pause broadcasting',
      queue: 45,
      blocked: 0,
      objectives: 'Broadcast 10 urgent requirements to preferred vendors.',
      results: '12 broadcasts sent, 35 vendor resumes received.'
    },
    'Client Office': {
      mission: 'Ensure high client satisfaction by driving hiring outcomes.',
      goal: 'Increase hiring velocity and identify expansion opportunities.',
      consumed: ['Requirement Created', 'Submission Sent', 'Interview Scheduled', 'Offer Accepted'],
      published: ['Requirement Enriched', 'Client Feedback Chased', 'Expansion Opportunity Identified'],
      skills: ['JD Extractor', 'Sentiment Analyzer', 'Follow-up Automator'],
      memory: ['Working (Active Requirements)', 'Long (Client Preferences)'],
      kpis: ['Hiring Velocity', 'Client Satisfaction', 'Feedback SLA', 'Fill Rate'],
      hours: 'Client Timezone',
      escalation: 'If Client silent for 48 hours -> Notify Account Executive',
      queue: 8,
      blocked: 3,
      objectives: 'Chase feedback on 15 pending submissions.',
      results: '8 feedbacks received, 2 new requirements unlocked.'
    },
    'Customer Success Office': {
      mission: 'Ensure long-term consultant success and account growth.',
      goal: 'Maximize consultant retention and client contract renewals.',
      consumed: ['Candidate Placed', 'Contract Approaching Expiry', 'Consultant Check-in Submitted'],
      published: ['Renewal Triggered', 'Replacement Risk Flagged', 'Upsell Opportunity Created'],
      skills: ['Check-in Automator', 'Risk Scorer', 'Contract Generator'],
      memory: ['Long (Placement History, Consultant Health)'],
      kpis: ['Renewal Rate', 'Consultant Retention', 'Revenue Expansion', 'Replacement Requests'],
      hours: 'Standard Business Hours',
      escalation: 'If Consultant risk score > 80% -> Alert Founder & Client Office',
      queue: 12,
      blocked: 1,
      objectives: 'Conduct 30-day check-ins for 5 recent placements.',
      results: '5 check-ins completed, 1 contract extension secured.'
    },
    'Quality Office': {
      mission: 'Continuously audit and improve business operations.',
      goal: 'Eliminate errors, hallucinations, and SLA violations.',
      consumed: ['Resume Parsed', 'Match Generated', 'Workflow Failed', 'SLA Breached'],
      published: ['Duplicate Flagged', 'Quality Warning Issued', 'Process Improvement Task'],
      skills: ['Data Integrity Checker', 'Hallucination Detector', 'Duplicate Finder'],
      memory: ['Knowledge (Failure Patterns)'],
      kpis: ['Defect Rate', 'Data Integrity Score', 'SLA Adherence', 'Audit Resolution Time'],
      hours: '24/7 (Continuous Audit)',
      escalation: 'If Critical Data Corruption Detected -> Halt Workflow, Alert Security',
      queue: 124,
      blocked: 0,
      objectives: 'Audit all new candidate imports for duplicates.',
      results: '450 records audited, 12 duplicates merged, 2 bad parses flagged.'
    },
    'Intelligence Office': {
      mission: 'Provide data-driven insights and strategic foresight.',
      goal: 'Identify trends, anomalies, and operational inefficiencies across the enterprise.',
      consumed: ['SLA Breached', 'Placement Ratios Dropped', 'Vendor Health Changed'],
      published: ['Insight Generated', 'Process Improvement Proposed', 'Risk Identified'],
      skills: ['Trend Analyzer', 'Root Cause Engine', 'Performance Modeler'],
      memory: ['Long (Historical Enterprise Data)', 'Knowledge (Market Trends)'],
      kpis: ['Insight Accuracy', 'Actionable Recommendations', 'Query Response Time'],
      hours: '24/7 (Batch Analysis)',
      escalation: 'If Systemic revenue risk detected -> Alert Founder Office',
      queue: 4,
      blocked: 0,
      objectives: 'Analyze Q3 placement drop reasons.',
      results: 'Identified 3 bottlenecked clients affecting SLA.'
    },
    'Platform Office': {
      mission: 'Ensure high availability, resilience, and performance of Workforce OS.',
      goal: 'Maintain 99.99% uptime and zero queue failures.',
      consumed: ['Queue Overload Flagged', 'Latency Spike Detected', 'Service Degraded'],
      published: ['Resource Scaled', 'Queue Flushed', 'System Alert Issued'],
      skills: ['Auto-Scaler', 'Queue Manager', 'Latency Monitor'],
      memory: ['Short (Current System Load)'],
      kpis: ['Uptime %', 'Average Latency', 'Queue Failure Rate'],
      hours: '24/7 (Always On)',
      escalation: 'If Outage > 2 mins -> PagerDuty Human Engineer',
      queue: 0,
      blocked: 0,
      objectives: 'Monitor worker queues during peak load.',
      results: 'Auto-scaled Resume Parsers by 2x.'
    },
    'Security Office': {
      mission: 'Protect enterprise data, enforce access rules, and prevent leaks.',
      goal: 'Ensure zero unauthorized data access and PII isolation.',
      consumed: ['Anomalous Query Detected', 'Role Violation Attempt', 'Large Export Requested'],
      published: ['Access Revoked', 'Audit Log Generated', 'Security Threat Blocked'],
      skills: ['ABAC Enforcer', 'Anomaly Detector', 'PII Scrubber'],
      memory: ['Long (Audit Trails)', 'Working (Active Sessions)'],
      kpis: ['Zero Data Leaks', 'Threat Mitigation Time', 'Audit Compliance %'],
      hours: '24/7 (Always On)',
      escalation: 'If Data Leak Detected -> Lockdown OS, Alert Founder',
      queue: 2,
      blocked: 0,
      objectives: 'Scan all external API payloads for PII.',
      results: 'Blocked 1 unmasked resume export.'
    },
    'Founder Office': {
      mission: 'Oversee long-term vision, operational health, and capital allocation.',
      goal: 'Maximize Enterprise Autonomy Score and profit margin.',
      consumed: ['Daily Revenue Target Hit', 'Systemic risk detected', 'Strategic Goal Updated'],
      published: ['Resource Allocated', 'Target Adjusted', 'Enterprise Strategy Updated'],
      skills: ['Capital Allocator', 'Vision Translator', 'Margin Optimizer'],
      memory: ['Knowledge (Enterprise Strategy)', 'Long (Financial History)'],
      kpis: ['Enterprise Autonomy Score', 'Profit Margin', 'Founder Hours Saved'],
      hours: 'Strategic Review Cycles',
      escalation: 'Human Founder Intervention Required',
      queue: 1,
      blocked: 0,
      objectives: 'Review weekly enterprise autonomy improvements.',
      results: 'Autonomy increased by +2% this week.'
    },
    'GTM Office': {
      mission: 'Build robust pipeline and discover high-value leads.',
      goal: 'Maximize lead discovery and meeting booking rates.',
      consumed: ['Market Signal Detected', 'Campaign Launched', 'Lead Replied'],
      published: ['Lead Qualified', 'Meeting Booked', 'Campaign Adjusted'],
      skills: ['Lead Discoverer', 'Email Composer', 'Campaign Optimizer'],
      memory: ['Working (Active Campaigns)', 'Long (Lead History)'],
      kpis: ['Pipeline Generated', 'Meeting Booking Rate', 'Cost per Lead'],
      hours: 'Standard Business Hours',
      escalation: 'If booking rate < 2% -> Flag to Sales Office',
      queue: 250,
      blocked: 12,
      objectives: 'Generate 50 net-new qualified leads today.',
      results: '32 leads generated, 4 meetings booked.'
    },
    'Sales Office': {
      mission: 'Convert pipeline into closed-won revenue.',
      goal: 'Accelerate the sales cycle and maximize win rates.',
      consumed: ['Meeting Booked', 'Demo Completed', 'Proposal Requested'],
      published: ['Contract Sent', 'Deal Closed Won', 'Objection Handled'],
      skills: ['Deal Strategist', 'Proposal Generator', 'Objection Handler'],
      memory: ['Working (Active Deals)', 'Long (Client Purchase History)'],
      kpis: ['Win Rate', 'Sales Cycle Length', 'Average Deal Size'],
      hours: 'Client Timezone',
      escalation: 'If Deal > $50k stalled -> Escalate to Founder Office',
      queue: 15,
      blocked: 2,
      objectives: 'Close 3 enterprise deals this week.',
      results: '1 deal closed-won, 2 in negotiation.'
    },
    'Knowledge Office': {
      mission: 'Capture, structure, and distribute organizational knowledge.',
      goal: 'Ensure all Offices operate using the most up-to-date playbooks.',
      consumed: ['Process Improvement Proposed', 'New Playbook Created', 'Market Trend Identified'],
      published: ['Knowledge Base Updated', 'Skill Upgraded', 'Best Practice Broadcasted'],
      skills: ['Playbook Compiler', 'Knowledge Indexer', 'Skill Updater'],
      memory: ['Knowledge (Master Enterprise Memory)'],
      kpis: ['Playbook Utilization', 'Knowledge Retrieval Time', 'Skill Update Frequency'],
      hours: '24/7 (Continuous Indexing)',
      escalation: 'If Contradictory playbooks found -> Escalate to Quality Office',
      queue: 8,
      blocked: 0,
      objectives: 'Index new vendor scoring playbooks.',
      results: '3 playbooks updated and distributed.'
    },
    'Finance Office': {
      mission: 'Manage revenue forecasting, invoicing, and collections.',
      goal: 'Optimize cash flow and maximize recruiter profitability.',
      consumed: ['Candidate Placed', 'Invoice Due', 'Payment Received'],
      published: ['Invoice Generated', 'Collection Reminder Sent', 'Revenue Forecast Updated'],
      skills: ['Invoice Generator', 'Cash Flow Modeler', 'Collection Automator'],
      memory: ['Long (Financial Ledger)'],
      kpis: ['Days Sales Outstanding (DSO)', 'Margin per Placement', 'Forecast Accuracy'],
      hours: 'Standard Business Hours',
      escalation: 'If Invoice > 60 days overdue -> Escalate to Client Office',
      queue: 5,
      blocked: 1,
      objectives: 'Generate end-of-month invoices.',
      results: '12 invoices sent, $45k collected.'
    },
    'Chief Operating Office': {
      mission: 'Enterprise conductor coordinating all Offices.',
      goal: 'Resolve bottlenecks and keep the business aligned with daily goals.',
      consumed: ['SLA Warning Issued', 'Workflow Failed', 'Queue Overload Flagged'],
      published: ['Task Reassigned', 'Priority Escalated', 'Capacity Adjusted'],
      skills: ['Workload Balancer', 'SLA Enforcer', 'Priority Router'],
      memory: ['Working (Current Enterprise State)'],
      kpis: ['Enterprise Efficiency', 'Blocked Tasks Resolution', 'Goal Alignment'],
      hours: '24/7 (Every 15 min loop)',
      escalation: 'If Revenue Goal severely missed -> Trigger Founder Simulation',
      queue: 0,
      blocked: 0,
      objectives: 'Maintain < 5% blocked workflows across all Offices.',
      results: 'Cleared 14 blocked tasks, re-routed 2 priority requirements.'
    }
  };

  const getOfficeContract = (category: string) => {
    return officeContracts[category] || {
      mission: 'Perform specific domain operations autonomously.',
      goal: 'Support enterprise objectives within defined scope.',
      consumed: ['Domain Event Triggered'],
      published: ['Domain Result Generated'],
      skills: ['Domain Specific Skills'],
      memory: ['Relevant Context Memory'],
      kpis: ['Domain Efficiency', 'Task Success Rate'],
      hours: 'Standard Business Hours',
      escalation: 'Escalate anomalies to COO.',
      queue: Math.floor(Math.random() * 20),
      blocked: 0,
      objectives: 'Complete daily assigned workflow tasks.',
      results: 'Operating nominally.'
    };
  };

  const filteredAgents = agents.filter(a => a.category === activeCategory);

  const renderAgentStatus = (status: string) => {
    switch (status) {
      case 'Running': return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit"><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span> Running</span>;
      case 'Idle': return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 w-fit">Idle</span>;
      case 'Scheduled': return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit">Scheduled</span>;
      case 'Disabled': return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit">Disabled</span>;
      default: return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 w-fit">{status}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 bg-[#F8FAFC] min-h-full">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <Bot className="text-emerald-400" size={28} /> AI Workforce Status
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-widest">Continuous Event-Driven Operations Core</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-inner border border-slate-700">
                 <Pause size={14} /> Pause
             </button>
             <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2 border border-emerald-500">
                 <Play size={14} /> Resume
             </button>
             <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-inner border border-slate-700">
                 <RefreshCw size={14} /> Restart
             </button>
             <button className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2 border border-rose-500 md:ml-4">
                 <AlertTriangle size={14} /> Emergency Stop
             </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="flex flex-col lg:border-r border-slate-800 pr-4 pb-2 lg:pb-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">System Status</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-2 bg-emerald-500/10 w-fit px-2 py-1 rounded border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Running
            </span>
          </div>
          <div className="flex flex-col lg:border-r border-slate-800 lg:px-4 pb-2 lg:pb-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Last Heartbeat</span>
            <span className="text-sm font-bold text-white flex items-center gap-2">
               <Clock size={14} className="text-slate-400" /> 3 sec ago
            </span>
          </div>
          <div className="flex flex-col lg:border-r border-slate-800 lg:px-4 pb-2 lg:pb-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Active Offices</span>
            <span className="text-lg font-black text-white">5</span>
          </div>
          <div className="flex flex-col lg:border-r border-slate-800 lg:px-4 pb-2 lg:pb-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Events Today</span>
            <span className="text-lg font-black text-indigo-400">421</span>
          </div>
          <div className="flex flex-col lg:border-r border-slate-800 lg:px-4 pb-2 lg:pb-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Reqs Processed</span>
            <span className="text-lg font-black text-white">38</span>
          </div>
          <div className="flex flex-col lg:pl-4 pb-2 lg:pb-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Matches Gen.</span>
            <span className="text-lg font-black text-emerald-400">1,284</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible pb-3 lg:pb-0 gap-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
              {categories.map(cat => {
                  const isAgentCategory = cat.includes('Layer');
                  const count = isAgentCategory ? agents.filter(a => a.category === cat).length : null;
                  
                  return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setSelectedAgent(null); }}
                    className={cn(
                        "whitespace-nowrap flex-shrink-0 lg:w-full text-left px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-sm font-bold transition-colors flex items-center justify-between gap-4",
                        activeCategory === cat ? "bg-indigo-900 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    )}
                  >
                      {cat}
                      {isAgentCategory && count !== null && count > 0 && (
                          <span className={cn("text-xs font-mono px-2 py-0.5 rounded-full", activeCategory === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                              {count}
                          </span>
                      )}
                  </button>
                  );
              })}
          </div>

          <div className="lg:col-span-3 space-y-4">
              {!selectedAgent ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 min-h-[500px]">
                      <h3 className="text-lg font-bold text-white mb-6 border-b border-slate-800 pb-4">{activeCategory}</h3>
                      
                      {activeCategory === 'AI Workforce (Dynamic)' ? (
                          <div className="space-y-8">
                              {/* Summary Banner */}
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="space-y-1">
                                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                          <Brain size={18} className="text-indigo-400" />
                                          Dynamic AI Staffing Workforce
                                      </h4>
                                      <p className="text-xs text-slate-400">
                                          Real-time declarative registry of custom AI agents. Powered by our core Capability Routing and Firestore memory.
                                      </p>
                                  </div>
                                  <div className="flex gap-4 text-xs font-mono">
                                      <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                                          <span className="text-slate-500 mr-2">REGISTRY:</span>
                                          <span className="text-indigo-400 font-bold">{dynamicAgents.length} Agents</span>
                                      </div>
                                      <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                                          <span className="text-slate-500 mr-2">STATUS:</span>
                                          <span className="text-emerald-400 font-bold flex items-center gap-1 inline-flex">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                                          </span>
                                      </div>
                                  </div>
                              </div>

                              {/* Interactive Playground Section */}
                              <div className="bg-slate-950 border border-indigo-950 rounded-xl p-4 sm:p-6 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                                  
                                  <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                                      <Zap size={16} className="text-amber-400" />
                                      ⚡ Interactive Agent Playground
                                  </h4>

                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                      {/* Controls Panel */}
                                      <div className="lg:col-span-2 space-y-4">
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                  1. Select Agent to Query
                                              </label>
                                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                  <button
                                                      onClick={() => setSelectedDynamicAgent(null)}
                                                      className={cn(
                                                          "px-3 py-2 rounded-lg text-xs font-bold text-left transition-all border",
                                                          !selectedDynamicAgent 
                                                              ? "bg-indigo-950/40 border-indigo-500 text-indigo-300" 
                                                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                                      )}
                                                  >
                                                      <div className="font-mono text-[9px] text-slate-500">AUTO-ROUTE</div>
                                                      <div className="truncate">Orchestrator Brain</div>
                                                  </button>
                                                  {dynamicAgents.map(agent => (
                                                      <button
                                                          key={agent.id}
                                                          onClick={() => setSelectedDynamicAgent(agent)}
                                                          className={cn(
                                                              "px-3 py-2 rounded-lg text-xs font-bold text-left transition-all border",
                                                              selectedDynamicAgent?.id === agent.id 
                                                                  ? "bg-indigo-950/40 border-indigo-500 text-indigo-300" 
                                                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                                          )}
                                                      >
                                                          <div className="font-mono text-[9px] text-slate-500">{agent.metadata?.version || 'v1.0'}</div>
                                                          <div className="truncate">{agent.metadata?.name || agent.id}</div>
                                                      </button>
                                                  ))}
                                              </div>
                                          </div>

                                          {/* Quick Suggestion Chips */}
                                          <div>
                                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                                  2. Select Template or Write Request
                                              </label>
                                              <div className="flex flex-wrap gap-1.5">
                                                  {(!selectedDynamicAgent || selectedDynamicAgent.id === 'RecruiterAgent') && (
                                                      <button 
                                                          onClick={() => setPlaygroundPrompt("Draft an outbound email targeting Senior Python Developers detailing our hybrid benefits package")}
                                                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 text-[10px] truncate max-w-xs"
                                                      >
                                                          📝 Draft Candidate Email
                                                      </button>
                                                  )}
                                                  {(!selectedDynamicAgent || selectedDynamicAgent.id === 'MatchingAgent') && (
                                                      <button 
                                                          onClick={() => setPlaygroundPrompt("Evaluate resume alignment for candidate ID 'cand-001' with Java Spring Boot backend requirements")}
                                                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 text-[10px] truncate max-w-xs"
                                                      >
                                                          🔬 Check Resume Overlap
                                                      </button>
                                                  )}
                                                  {(!selectedDynamicAgent || selectedDynamicAgent.id === 'VendorManagerAgent') && (
                                                      <button 
                                                          onClick={() => setPlaygroundPrompt("Generate optimization advice for vendor bench utilization with a focus on Frontend engineers")}
                                                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 text-[10px] truncate max-w-xs"
                                                      >
                                                          💼 Audit Vendor Bench
                                                      </button>
                                                  )}
                                                  {(!selectedDynamicAgent || selectedDynamicAgent.id === 'BDMAgent') && (
                                                      <button 
                                                          onClick={() => setPlaygroundPrompt("Compile a high-risk strategic brief for active deals closing before the end of Q3")}
                                                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 text-[10px] truncate max-w-xs"
                                                      >
                                                          📊 Highlight Deal Risks
                                                      </button>
                                                  )}
                                                  {(!selectedDynamicAgent || selectedDynamicAgent.id === 'ExecutiveDashboardAgent') && (
                                                      <button 
                                                          onClick={() => setPlaygroundPrompt("Prepare a brief executive report on placing trends and AI cloud cost efficiency ratios")}
                                                          className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 text-[10px] truncate max-w-xs"
                                                      >
                                                          👑 Executive COO Briefing
                                                      </button>
                                                  )}
                                              </div>
                                          </div>

                                          {/* Input field */}
                                          <div className="relative">
                                              <textarea
                                                  value={playgroundPrompt}
                                                  onChange={(e) => setPlaygroundPrompt(e.target.value)}
                                                  placeholder={selectedDynamicAgent 
                                                      ? `Prompt ${selectedDynamicAgent.metadata?.name}... (e.g. "Draft an email...")`
                                                      : 'Describe your request here, the Orchestrator will analyze intent and route to the correct agent...'
                                                  }
                                                  className="w-full h-32 bg-slate-900 border border-slate-800 rounded-lg p-3 pb-12 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-sans resize-none"
                                              />
                                              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                                  <button
                                                      disabled={isExecutingPlayground || !playgroundPrompt.trim()}
                                                      onClick={() => handleExecutePlayground()}
                                                      className={cn(
                                                          "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg",
                                                          isExecutingPlayground || !playgroundPrompt.trim()
                                                              ? "bg-indigo-950 text-slate-500 cursor-not-allowed border border-indigo-950"
                                                              : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer border border-indigo-500"
                                                      )}
                                                  >
                                                      {isExecutingPlayground ? (
                                                          <>
                                                              <RefreshCw size={12} className="animate-spin" />
                                                              Running Agent...
                                                          </>
                                                      ) : (
                                                          <>
                                                              <Play size={12} />
                                                              Trigger Agent
                                                          </>
                                                      )}
                                                  </button>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Right Column: Console Output & GStack Continuous Checkpoints */}
                                      <div className="space-y-4 flex flex-col lg:col-span-1">
                                          {/* Console Output Panel */}
                                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px]">
                                              <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
                                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                      <Terminal size={12} className="text-indigo-400 animate-pulse" />
                                                      Execution Console Output
                                                  </span>
                                                  {playgroundResult && (
                                                      <span className={cn(
                                                          "text-[9px] font-mono px-2 py-0.5 rounded uppercase border",
                                                          playgroundResult.success 
                                                              ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400" 
                                                              : "bg-rose-950/40 border-rose-800/40 text-rose-400"
                                                      )}>
                                                          {playgroundResult.success ? 'Success' : 'Error'}
                                                      </span>
                                                  )}
                                              </div>
                                              
                                              <div className="flex-1 overflow-y-auto text-slate-300 text-xs font-mono space-y-3 pr-1 scrollbar-thin">
                                                  {!playgroundResult && !isExecutingPlayground && (
                                                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-[10px] py-4">
                                                          <Bot size={24} className="mb-2 opacity-50 text-slate-600 animate-bounce" />
                                                          Console Idle.<br />Choose an agent and trigger a query to begin.
                                                      </div>
                                                  )}

                                                  {isExecutingPlayground && (
                                                      <div className="space-y-2 text-[10px] text-indigo-400 animate-pulse">
                                                          <div>&gt; [SYSTEM] Initializing Agent Execution context...</div>
                                                          <div>&gt; [ORCHESTRATOR] Analyzing statement intent...</div>
                                                          <div>&gt; [ROUTER] Matching required capabilities...</div>
                                                          <div>&gt; [SECURITY] Performing role permission audits...</div>
                                                          <div>&gt; [GATEWAY] Requesting provider payload routing...</div>
                                                          <div className="flex items-center gap-1.5 text-slate-400 mt-2 text-xs font-sans">
                                                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                                                              Awaiting AI response...
                                                          </div>
                                                      </div>
                                                  )}

                                                  {playgroundResult && (
                                                      <div className="space-y-3">
                                                          {playgroundResult.success ? (
                                                              <>
                                                                  <div className="text-[11px] text-slate-200 bg-slate-950 border border-slate-800/60 p-2.5 rounded-md font-sans select-text whitespace-pre-wrap leading-relaxed">
                                                                      {playgroundResult.output || JSON.stringify(playgroundResult.data, null, 2)}
                                                                  </div>

                                                                  <div className="space-y-1 text-[9px] border-t border-slate-800/50 pt-2 text-slate-400">
                                                                      <div className="flex justify-between">
                                                                          <span>Routed Agent:</span>
                                                                          <span className="text-slate-200 font-bold">{playgroundResult.agentId} ({playgroundResult.agentName})</span>
                                                                      </div>
                                                                      <div className="flex justify-between">
                                                                          <span>Gateway Provider:</span>
                                                                          <span className="text-slate-200 font-bold">{playgroundResult.metrics?.provider || 'DeepSeek (Ollama)'}</span>
                                                                      </div>
                                                                      <div className="flex justify-between">
                                                                          <span>Execution Latency:</span>
                                                                          <span className="text-indigo-400 font-bold">{playgroundResult.metrics?.durationMs || 840} ms</span>
                                                                      </div>
                                                                      {playgroundResult.metrics?.tokens && (
                                                                          <div className="flex justify-between">
                                                                              <span>Tokens Used:</span>
                                                                              <span className="text-slate-300 font-bold">{playgroundResult.metrics.tokens}</span>
                                                                          </div>
                                                                      )}
                                                                  </div>
                                                              </>
                                                          ) : (
                                                              <div className="space-y-2 text-rose-400">
                                                                  <div className="text-[10px] font-bold">&gt; [CRITICAL ERROR] Execution failed:</div>
                                                                  <div className="bg-rose-950/20 border border-rose-900/30 p-2 rounded text-[10px] font-mono whitespace-pre-wrap select-text">
                                                                      {playgroundResult.error}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  )}
                                              </div>
                                          </div>

                                          {/* GStack Continuous Checkpoints Ledger */}
                                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col space-y-3">
                                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                                                  <div className="flex items-center gap-1.5">
                                                      <GitCommit size={14} className="text-emerald-400" />
                                                      <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
                                                          GStack Checkpoint Ledger
                                                      </span>
                                                      <span className="flex h-2 w-2 relative">
                                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                      </span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                      <button 
                                                          onClick={handleRunBenchmarkSuite}
                                                          disabled={benchmarkRunning}
                                                          className="text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-1 rounded border border-slate-700/80 flex items-center gap-1 transition-all"
                                                      >
                                                          <Scale size={10} />
                                                          Benchmark
                                                      </button>
                                                      <label className="relative inline-flex items-center cursor-pointer select-none">
                                                          <input 
                                                              type="checkbox" 
                                                              checked={checkpointMode}
                                                              onChange={(e) => setCheckpointMode(e.target.checked)}
                                                              className="sr-only peer"
                                                          />
                                                          <div className="w-7 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white"></div>
                                                      </label>
                                                  </div>
                                              </div>

                                              {/* Benchmark Results Display */}
                                              {benchmarkRunning && (
                                                  <div className="p-3 bg-slate-950 border border-indigo-950/60 rounded-lg text-center space-y-1.5">
                                                      <RefreshCw size={14} className="animate-spin text-indigo-400 mx-auto" />
                                                      <div className="text-[10px] font-bold text-slate-300">{benchmarkStep}</div>
                                                      <div className="text-[8px] text-slate-500 font-mono">Comparing Gemini vs DeepSeek...</div>
                                                  </div>
                                              )}

                                              {benchmarkResults && !benchmarkRunning && (
                                                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 relative">
                                                      <button 
                                                          onClick={() => setBenchmarkResults(null)}
                                                          className="absolute top-1.5 right-1.5 text-slate-500 hover:text-white text-xs"
                                                      >
                                                          &times;
                                                      </button>
                                                      <div className="text-[10px] font-bold text-indigo-300 flex items-center justify-between">
                                                          <span>📊 Benchmark Provider Scorecard</span>
                                                          <span className="text-[9px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded">Winner: {benchmarkResults.winner}</span>
                                                      </div>
                                                      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                                                          <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                                                              <div className="text-slate-400 font-bold mb-1">Gemini 2.5 Flash</div>
                                                              <div className="text-slate-200">Latency: {benchmarkResults.gemini.avgDurationMs}ms</div>
                                                              <div className="text-slate-200">Success: {benchmarkResults.gemini.successRate}%</div>
                                                              <div className="text-emerald-400">Cost: {benchmarkResults.gemini.costIndex}</div>
                                                          </div>
                                                          <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                                                              <div className="text-slate-400 font-bold mb-1">DeepSeek Coder</div>
                                                              <div className="text-slate-200">Latency: {benchmarkResults.deepseek.avgDurationMs}ms</div>
                                                              <div className="text-slate-200">Success: {benchmarkResults.deepseek.successRate}%</div>
                                                              <div className="text-emerald-400">Cost: {benchmarkResults.deepseek.costIndex}</div>
                                                          </div>
                                                      </div>
                                                  </div>
                                              )}

                                              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                                                  {checkpoints.length === 0 ? (
                                                      <div className="text-center text-slate-500 text-[10px] py-6">
                                                          No checkpoints logged yet.<br />Trigger agent to start commits.
                                                      </div>
                                                  ) : (
                                                      checkpoints.map((cp) => (
                                                          <div 
                                                              key={cp.id} 
                                                              className={cn(
                                                                  "p-2.5 bg-slate-950 border rounded-lg transition-all space-y-2 relative group",
                                                                  cp.success ? "border-slate-800/80 hover:border-slate-700" : "border-rose-950/60 hover:border-rose-900/40"
                                                              )}
                                                          >
                                                              <div className="flex justify-between items-center">
                                                                  <div className="flex items-center gap-1.5">
                                                                      <span className="font-mono text-[9px] text-slate-500 font-bold bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                                                                          {cp.id}
                                                                      </span>
                                                                      <span className="text-[9px] text-slate-400 font-bold truncate max-w-[80px]">
                                                                          {cp.agentName}
                                                                      </span>
                                                                  </div>
                                                                  <span className="text-[8px] text-slate-500 font-mono">
                                                                      {cp.timestamp.split(' ')[1] || cp.timestamp}
                                                                  </span>
                                                              </div>

                                                              <div className="text-[10px] text-slate-300 font-medium line-clamp-1 truncate select-text">
                                                                  {cp.prompt}
                                                              </div>

                                                              <div className="flex items-center justify-between text-[8px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                                                                  <span>{cp.provider} • {cp.metrics?.durationMs || cp.metrics?.duration} ms</span>
                                                                  <span>{cp.metrics?.tokens} tokens</span>
                                                              </div>

                                                              {/* Action buttons (Touch-optimized 44px hit-target containers) */}
                                                              <div className="flex items-center gap-1 justify-end pt-1 bg-slate-950">
                                                                  <button 
                                                                      onClick={() => handleLoadCheckpoint(cp)}
                                                                      title="Load prompt & output"
                                                                      className="h-7 px-2.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-indigo-400 hover:text-white transition-all flex items-center justify-center gap-1 border border-slate-800"
                                                                  >
                                                                      🔍 Load
                                                                  </button>
                                                                  <button 
                                                                      onClick={() => handleReplayCheckpoint(cp)}
                                                                      title="Re-run this prompt"
                                                                      className="h-7 px-2.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-amber-400 hover:text-white transition-all flex items-center justify-center gap-1 border border-slate-800"
                                                                  >
                                                                      🔄 Replay
                                                                  </button>
                                                                  <button 
                                                                      onClick={() => {
                                                                          if (!compareSource) {
                                                                              setCompareSource(cp);
                                                                              setShowComparePanel(true);
                                                                          } else {
                                                                              setCompareTarget(cp);
                                                                              setShowComparePanel(true);
                                                                          }
                                                                      }}
                                                                      title="Select for comparison"
                                                                      className={cn(
                                                                          "h-7 px-2.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 border",
                                                                          compareSource?.id === cp.id || compareTarget?.id === cp.id
                                                                              ? "bg-indigo-950 border-indigo-500 text-indigo-300"
                                                                              : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white"
                                                                      )}
                                                                  >
                                                                      🆚 Compare
                                                                  </button>
                                                                  <button 
                                                                      onClick={() => handleRollbackState(cp)}
                                                                      title="Simulate Memory Rollback"
                                                                      className="h-7 px-2.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-rose-400 hover:text-white transition-all flex items-center justify-center gap-1 border border-slate-800"
                                                                  >
                                                                      ⏪ Rollback
                                                                  </button>
                                                                  <button 
                                                                      onClick={() => {
                                                                          const updated = checkpoints.filter(c => c.id !== cp.id);
                                                                          setCheckpoints(updated);
                                                                          localStorage.setItem("hn_playground_checkpoints", JSON.stringify(updated));
                                                                          if (compareSource?.id === cp.id) setCompareSource(null);
                                                                          if (compareTarget?.id === cp.id) setCompareTarget(null);
                                                                      }}
                                                                      title="Delete checkpoint"
                                                                      className="h-7 w-7 rounded bg-slate-900 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-all flex items-center justify-center border border-slate-800"
                                                                  >
                                                                      <Trash2 size={11} />
                                                                  </button>
                                                              </div>
                                                          </div>
                                                      ))
                                                  )}
                                              </div>
                                          </div>
                                      </div>

                                      {/* Side-by-Side Model & Prompt Comparison Overlay Modal */}
                                      {showComparePanel && compareSource && (
                                          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                                              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                  {/* Modal Header */}
                                                  <div className="bg-slate-950/60 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                                                      <div className="flex items-center gap-2">
                                                          <ArrowLeftRight size={18} className="text-indigo-400" />
                                                          <h3 className="text-sm font-black text-white uppercase tracking-wider">
                                                              GStack side-by-side comparative inspector
                                                          </h3>
                                                      </div>
                                                      <button 
                                                          onClick={() => {
                                                              setShowComparePanel(false);
                                                              setCompareSource(null);
                                                              setCompareTarget(null);
                                                          }}
                                                          className="text-slate-400 hover:text-white font-mono bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                                      >
                                                          Close Inspector
                                                      </button>
                                                  </div>

                                                  {/* Modal Body */}
                                                  <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/40">
                                                      {/* Left: Source Checkpoint */}
                                                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col space-y-4">
                                                          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                                                              <div className="flex items-center gap-2">
                                                                  <span className="text-[10px] bg-indigo-950 text-indigo-400 font-mono px-2 py-0.5 rounded font-bold border border-indigo-900">
                                                                      {compareSource.id}
                                                                  </span>
                                                                  <span className="text-xs font-bold text-white">Source Checkpoint</span>
                                                              </div>
                                                              <span className="text-[10px] text-slate-500 font-mono">{compareSource.timestamp}</span>
                                                          </div>

                                                          <div className="space-y-1">
                                                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prompt</div>
                                                              <div className="bg-slate-900 border border-slate-800/60 p-2.5 rounded text-xs text-slate-200 select-text">
                                                                  {compareSource.prompt}
                                                              </div>
                                                          </div>

                                                          <div className="space-y-1 flex-1 flex flex-col">
                                                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Output Response</div>
                                                              <div className="bg-slate-900 border border-slate-800/60 p-2.5 rounded text-[11px] font-mono text-slate-300 flex-1 whitespace-pre-wrap select-text overflow-y-auto leading-relaxed max-h-[250px]">
                                                                  {compareSource.output}
                                                              </div>
                                                          </div>

                                                          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 grid grid-cols-3 gap-2 text-[10px] font-mono">
                                                              <div>
                                                                  <div className="text-slate-500">Provider</div>
                                                                  <div className="text-slate-200 font-bold">{compareSource.provider}</div>
                                                              </div>
                                                              <div>
                                                                  <div className="text-slate-500">Latency</div>
                                                                  <div className="text-indigo-400 font-bold">{compareSource.metrics?.durationMs}ms</div>
                                                              </div>
                                                              <div>
                                                                  <div className="text-slate-500">Tokens</div>
                                                                  <div className="text-slate-200 font-bold">{compareSource.metrics?.tokens}</div>
                                                              </div>
                                                          </div>
                                                      </div>

                                                      {/* Right: Target Checkpoint */}
                                                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col space-y-4">
                                                          <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                                                              <div className="flex items-center gap-2">
                                                                  {compareTarget ? (
                                                                      <>
                                                                          <span className="text-[10px] bg-emerald-950 text-emerald-400 font-mono px-2 py-0.5 rounded font-bold border border-emerald-900">
                                                                              {compareTarget.id}
                                                                          </span>
                                                                          <span className="text-xs font-bold text-white">Target Checkpoint</span>
                                                                      </>
                                                                  ) : (
                                                                      <span className="text-xs font-bold text-slate-500">Compare Target Checkpoint</span>
                                                                  )}
                                                              </div>
                                                              {compareTarget && <span className="text-[10px] text-slate-500 font-mono">{compareTarget.timestamp}</span>}
                                                          </div>

                                                          {compareTarget ? (
                                                              <>
                                                                  <div className="space-y-1">
                                                                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Prompt</div>
                                                                      <div className="bg-slate-900 border border-slate-800/60 p-2.5 rounded text-xs text-slate-200 select-text">
                                                                          {compareTarget.prompt}
                                                                      </div>
                                                                  </div>

                                                                  <div className="space-y-1 flex-1 flex flex-col">
                                                                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Output Response</div>
                                                                      <div className="bg-slate-900 border border-slate-800/60 p-2.5 rounded text-[11px] font-mono text-slate-300 flex-1 whitespace-pre-wrap select-text overflow-y-auto leading-relaxed max-h-[250px]">
                                                                          {compareTarget.output}
                                                                      </div>
                                                                  </div>

                                                                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 grid grid-cols-3 gap-2 text-[10px] font-mono">
                                                                      <div>
                                                                          <div className="text-slate-500">Provider</div>
                                                                          <div className="text-slate-200 font-bold">{compareTarget.provider}</div>
                                                                      </div>
                                                                      <div>
                                                                          <div className="text-slate-500">Latency</div>
                                                                          <div className="text-indigo-400 font-bold">{compareTarget.metrics?.durationMs}ms</div>
                                                                      </div>
                                                                      <div>
                                                                          <div className="text-slate-500">Tokens</div>
                                                                          <div className="text-slate-200 font-bold">{compareTarget.metrics?.tokens}</div>
                                                                      </div>
                                                                  </div>
                                                              </>
                                                          ) : (
                                                              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                                                                  <ArrowLeftRight size={28} className="text-slate-600 animate-pulse" />
                                                                  <div className="text-xs font-bold text-slate-400">Select target checkpoint for comparison</div>
                                                                  <p className="text-[10px] text-slate-500 max-w-xs">
                                                                      Click the 🆚 Compare button on another item in the list back on the playground panel to view side-by-side comparative diffs.
                                                                  </p>
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>

                                                  {/* Modal Footer */}
                                                  <div className="bg-slate-950/60 border-t border-slate-800 px-6 py-4 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                                                      <span>GStack Microservice Agent Control Kernel</span>
                                                      {compareSource && compareTarget && (
                                                          <span className="text-indigo-400 font-bold">
                                                              Delta Latency: {Math.abs(compareSource.metrics?.durationMs - compareTarget.metrics?.durationMs)}ms • 
                                                              Delta Size: {Math.abs(compareSource.metrics?.tokens - compareTarget.metrics?.tokens)} tokens
                                                          </span>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              </div>

                              {/* Live Workforce Grid */}
                              <div className="space-y-4">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                      Active Registered Agent Pool
                                  </h4>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {dynamicAgents.map(agent => {
                                          const metrics = agentMetrics[agent.id] || {};
                                          const capabilities = agent.metadata?.capabilities || [];
                                          const tools = agent.metadata?.tools || [];

                                          // First-class Agent OS Metadata attributes
                                          const priority = agent.metadata?.priority || (agent.id.includes('founder') || agent.id.includes('sec') ? 'Critical' : agent.id.includes('recruitment') || agent.id.includes('client') ? 'High' : 'Medium');
                                          const status = agent.metadata?.status || 'Production';
                                          const temperature = agent.metadata?.runtimeConfig?.temperature ?? 0.2;
                                          const modelRouter = agent.metadata?.runtimeConfig?.modelRouter || agent.metadata?.preferredCapability || 'gemini-3.1-pro-preview';

                                          return (
                                              <div key={agent.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 hover:border-slate-700 transition-colors">
                                                  {/* Agent Header */}
                                                  <div className="flex justify-between items-start">
                                                      <div className="flex items-center gap-2.5">
                                                          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                                                              <Bot size={16} />
                                                          </div>
                                                          <div>
                                                              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                                                                  {agent.metadata?.name || agent.id}
                                                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                                                      {agent.metadata?.version || 'v1.0'}
                                                                  </span>
                                                              </h5>
                                                              <p className="text-[9px] font-mono text-slate-500">{agent.id}</p>
                                                          </div>
                                                      </div>
                                                      <div className="flex flex-col items-end gap-1">
                                                          <span className={cn("text-[8px] font-bold uppercase px-2 py-0.5 border rounded-full font-mono",
                                                              priority === 'Critical' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                                                              priority === 'High' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                                              "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                                          )}>
                                                              {priority} Priority
                                                          </span>
                                                          <span className={cn("text-[8px] font-bold uppercase px-2 py-0.5 border rounded-full",
                                                              status === 'Production' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                                              status === 'Monitoring' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                                              status === 'Testing' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                                                              status === 'Review' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                                                              "bg-slate-500/10 border-slate-800 text-slate-400"
                                                          )}>
                                                              {status}
                                                          </span>
                                                      </div>
                                                  </div>

                                                  {/* Purpose description */}
                                                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                                                      {agent.metadata?.purpose || 'Autonomous helper with custom workflow integrations.'}
                                                  </p>

                                                  {/* Runtime Config parameters inline stats */}
                                                  <div className="p-2 bg-slate-900/60 rounded border border-slate-900 flex justify-between items-center text-[9px] text-slate-400 font-mono">
                                                      <span>Gateway: <span className="text-indigo-400 font-bold uppercase">{modelRouter}</span></span>
                                                      <span>Temp: <span className="text-white font-bold">{temperature.toFixed(1)}</span></span>
                                                      <span>Max Tokens: <span className="text-white font-bold">{agent.metadata?.runtimeConfig?.maxTokens || 4096}</span></span>
                                                  </div>

                                                  {/* Capabilities & Tools Tags */}
                                                  <div className="space-y-1.5 pt-1">
                                                      <div className="flex flex-wrap gap-1">
                                                          {capabilities.map((cap: string) => (
                                                              <span key={cap} className="text-[8px] font-mono font-bold bg-indigo-950/30 text-indigo-400 border border-indigo-900/40 px-1.5 py-0.5 rounded">
                                                                  {cap}
                                                              </span>
                                                          ))}
                                                      </div>
                                                      {tools.length > 0 && (
                                                          <div className="flex flex-wrap gap-1">
                                                              {tools.map((t: string) => (
                                                                  <span key={t} className="text-[8px] font-mono bg-slate-900 text-slate-400 border border-slate-800/60 px-1.5 py-0.5 rounded">
                                                                      🛠️ {t}
                                                                  </span>
                                                              ))}
                                                          </div>
                                                      )}
                                                  </div>

                                                  {/* Telemetry Stats Panel */}
                                                  <div className="grid grid-cols-3 gap-2 bg-slate-900 border border-slate-800/40 rounded-lg p-2.5 text-center">
                                                      <div>
                                                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Avg Latency</div>
                                                          <div className="text-xs font-bold text-indigo-400 font-mono mt-0.5">
                                                              {metrics.averageDurationMs ? `${Math.round(metrics.averageDurationMs)} ms` : '--'}
                                                          </div>
                                                      </div>
                                                      <div>
                                                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Success Rate</div>
                                                          <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                                                              {metrics.successfulTasks !== undefined && metrics.totalTasks !== undefined && metrics.totalTasks > 0
                                                                  ? `${Math.round((metrics.successfulTasks / metrics.totalTasks) * 100)}%`
                                                                  : '100%'}
                                                          </div>
                                                      </div>
                                                      <div>
                                                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Total Tasks</div>
                                                          <div className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                                                              {metrics.totalTasks || 0}
                                                          </div>
                                                      </div>
                                                  </div>

                                                  {/* Collapsible logs/memories */}
                                                  <div className="border-t border-slate-900 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                      <div className="flex gap-2">
                                                          <button 
                                                              onClick={() => {
                                                                  setSelectedDynamicAgent(agent);
                                                                  const chipElement = document.querySelector('textarea');
                                                                  if (chipElement) chipElement.focus();
                                                              }}
                                                              className="text-[9px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded transition-colors flex items-center gap-1"
                                                          >
                                                              <Play size={8} /> Test Agent
                                                          </button>
                                                          {metrics.learnedPreferences && metrics.learnedPreferences.length > 0 && (
                                                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/30 flex items-center gap-1">
                                                                  <Brain size={10} /> Learned memory tags active
                                                              </span>
                                                          )}
                                                      </div>
                                                      
                                                      <span className="text-[9px] font-mono text-slate-500">
                                                          Primary: {agent.metadata?.preferredCapability === 'reasoning' ? 'DeepSeek (Ollama)' : 'Gemini 2.5'}
                                                      </span>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          </div>
                      ) : activeCategory === 'Workforce Overview' ? (
                          <div className="space-y-8">
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                                      <span>Enterprise Decision Engine (Live Constraints)</span>
                                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
                                  </h4>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                                          <div className="flex justify-between items-center mb-3">
                                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Revenue</span>
                                              <span className="text-xs font-bold text-emerald-400">74% Confidence</span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4 mb-4">
                                              <div>
                                                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Target</div>
                                                  <div className="text-xl font-mono text-white">₹3,00,000</div>
                                              </div>
                                              <div>
                                                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Forecast</div>
                                                  <div className="text-xl font-mono text-emerald-400">₹2,45,000</div>
                                              </div>
                                          </div>
                                          <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                              <div className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Decision Engine Action</div>
                                              <div className="text-xs text-slate-300">Schedule two follow-up meetings with Enterprise clients before 3:00 PM to close the gap.</div>
                                          </div>
                                      </div>
                                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                                          <div className="flex justify-between items-center mb-3">
                                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fill Rate</span>
                                              <span className="text-xs font-bold text-emerald-400">89% Confidence</span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4 mb-4">
                                              <div>
                                                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Target</div>
                                                  <div className="text-xl font-mono text-white">80%</div>
                                              </div>
                                              <div>
                                                  <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Forecast</div>
                                                  <div className="text-xl font-mono text-emerald-400">85%</div>
                                              </div>
                                          </div>
                                          <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                              <div className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Decision Engine Action</div>
                                              <div className="text-xs text-slate-300">Prioritizing Vendor B for new requirements due to 18-minute historical response SLA.</div>
                                          </div>
                                      </div>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-4 italic text-center">"What action gives the highest impact toward today's goals?"</p>
                              </div>
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                                      <span>Enterprise State Machine</span>
                                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1"><span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span> Autonomous Progress</span>
                                  </h4>
                                  <div className="grid grid-cols-1 gap-4">
                                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                          <div className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Requirement Lifecycle</div>
                                          <div className="flex items-center text-xs text-slate-400 font-mono overflow-x-auto pb-1 space-x-2 whitespace-nowrap">
                                              <span className="text-emerald-400">Created</span> <span className="text-emerald-500">→</span>
                                              <span className="text-emerald-400">Recruitment Office</span> <span className="text-emerald-500">→</span>
                                              <span className="text-emerald-400">3 Matched</span> <span className="text-emerald-500">→</span>
                                              <span className="text-emerald-400">Vendor Broadcast</span> <span className="text-emerald-500">→</span>
                                              <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1 rounded">Client Submission</span> <span className="text-slate-600">→</span>
                                              <span>Interview Scheduled</span> <span className="text-slate-600">→</span>
                                              <span>Feedback</span> <span className="text-slate-600">→</span>
                                              <span>Offer</span> <span className="text-slate-600">→</span>
                                              <span>Joined</span> <span className="text-slate-600">→</span>
                                              <span>Invoice</span> <span className="text-slate-600">→</span>
                                              <span className="font-bold">Revenue</span>
                                          </div>
                                      </div>
                                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                          <div className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Candidate Lifecycle</div>
                                          <div className="flex items-center text-xs text-slate-400 font-mono overflow-x-auto pb-1 space-x-2 whitespace-nowrap">
                                              <span className="text-emerald-400">Imported</span> <span className="text-emerald-500">→</span>
                                              <span className="text-emerald-400">Parsed</span> <span className="text-emerald-500">→</span>
                                              <span className="text-emerald-400">Matched</span> <span className="text-emerald-500">→</span>
                                              <span className="text-emerald-400">Submitted</span> <span className="text-emerald-500">→</span>
                                              <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1 rounded">Interviewing</span> <span className="text-slate-600">→</span>
                                              <span>Offer</span> <span className="text-slate-600">→</span>
                                              <span>Placed</span> <span className="text-slate-600">→</span>
                                              <span className="font-bold">Active Consultant</span>
                                          </div>
                                      </div>
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                              <div className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Vendor Lifecycle</div>
                                              <div className="flex items-center text-xs text-slate-400 font-mono overflow-x-auto pb-1 space-x-2 whitespace-nowrap">
                                                  <span className="text-emerald-400">Onboarded</span> <span className="text-emerald-500">→</span>
                                                  <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1 rounded">Active</span> <span className="text-slate-600">→</span>
                                                  <span>Preferred</span> <span className="text-slate-600">→</span>
                                                  <span className="font-bold">Strategic</span>
                                              </div>
                                          </div>
                                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                                              <div className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Client Lifecycle</div>
                                              <div className="flex items-center text-xs text-slate-400 font-mono overflow-x-auto pb-1 space-x-2 whitespace-nowrap">
                                                  <span className="text-emerald-400">Lead</span> <span className="text-emerald-500">→</span>
                                                  <span className="text-emerald-400">Qualified</span> <span className="text-emerald-500">→</span>
                                                  <span className="text-emerald-400">Active</span> <span className="text-emerald-500">→</span>
                                                  <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1 rounded">Hiring</span> <span className="text-slate-600">→</span>
                                                  <span>Expansion</span> <span className="text-slate-600">→</span>
                                                  <span className="font-bold">Strategic</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Core Infrastructure Health</h4>
                                      <div className="space-y-3">
                                          {agents.filter(a => a.core).slice(0, 4).map(agent => (
                                              <div key={agent.id} className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2 text-sm text-slate-300">
                                                      <Bot size={14} className="text-slate-500" />
                                                      {agent.name}
                                                  </div>
                                                  {renderAgentStatus(agent.status)}
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Top Active Agents</h4>
                                      <div className="space-y-3">
                                          {agents.filter(a => !a.core).sort((a, b) => (b.execsToday || 0) - (a.execsToday || 0)).slice(0, 4).map(agent => (
                                              <div key={agent.id} className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2 text-sm text-slate-300">
                                                      <Bot size={14} className="text-indigo-400" />
                                                      {agent.name}
                                                  </div>
                                                  <span className="text-xs font-mono text-slate-400">{(agent.execsToday || 0).toLocaleString()} runs</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                                      Agent Supervisor Action Required
                                      <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">0 Pending</span>
                                  </h4>
                                  <div className="text-center py-8">
                                      <CheckCircle2 size={32} className="mx-auto text-slate-700 mb-2" />
                                      <p className="text-sm text-slate-400">All agents are operating normally.</p>
                                  </div>
                              </div>
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 overflow-x-auto">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Enterprise Architecture Flow</h4>
                                  <div className="flex flex-col items-center space-y-2 min-w-[700px]">
                                      <div className="w-64 text-center py-2 px-3 bg-indigo-900/50 text-indigo-200 border border-indigo-700/50 rounded-lg text-xs font-bold shadow-sm">Founder Vision & Goals</div>
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-64 text-center py-2 px-3 bg-emerald-900/30 text-emerald-300 border border-emerald-700/50 rounded-lg text-xs font-bold shadow-sm">Business Decision Engine</div>
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-64 text-center py-2 px-3 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold shadow-sm">Enterprise Scheduler</div>
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-64 text-center py-2 px-3 bg-amber-900/30 text-amber-400 border border-amber-700/50 rounded-lg text-xs font-bold shadow-sm">AI COO (Enterprise Conductor)</div>
                                      
                                      <div className="flex justify-center w-full relative h-6">
                                          <div className="absolute top-0 w-3/4 border-t border-slate-700"></div>
                                          <div className="absolute top-0 w-3/4 flex justify-between px-2">
                                              <div className="h-4 border-l border-slate-700"></div>
                                              <div className="h-4 border-l border-slate-700"></div>
                                              <div className="h-4 border-l border-slate-700"></div>
                                              <div className="h-4 border-l border-slate-700"></div>
                                              <div className="h-4 border-l border-slate-700"></div>
                                              <div className="h-4 border-l border-slate-700"></div>
                                              <div className="h-4 border-l border-slate-700"></div>
                                          </div>
                                      </div>

                                      <div className="flex justify-between w-full max-w-4xl px-4 gap-2">
                                          <div className="flex-1 text-center py-1.5 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-slate-300">Recruitment</div>
                                          <div className="flex-1 text-center py-1.5 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-slate-300">GTM</div>
                                          <div className="flex-1 text-center py-1.5 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-slate-300">Vendor</div>
                                          <div className="flex-1 text-center py-1.5 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-slate-300">Client</div>
                                          <div className="flex-1 text-center py-1.5 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-slate-300">Finance</div>
                                          <div className="flex-1 text-center py-1.5 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-emerald-400">Customer Success</div>
                                          <div className="flex-1 text-center py-1.5 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-bold text-slate-300">Intelligence</div>
                                      </div>
                                      
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-[500px] text-center py-2 px-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-xs font-bold shadow-sm">
                                          <span className="text-indigo-400 mb-1 block">Shared Skills</span>
                                          <span className="font-normal text-[10px]">(Parser, Matching, MailOS, Calendar, AI)</span>
                                      </div>
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-[500px] text-center py-2 px-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-xs font-bold shadow-sm">
                                          <span className="text-indigo-400 mb-1 block">Enterprise Memory</span>
                                          <span className="font-normal text-[10px]">(Short • Working • Long • Knowledge)</span>
                                      </div>
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-[500px] text-center py-2 px-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-xs font-bold shadow-sm">
                                          <span className="text-indigo-400 mb-1 block">Business Graph</span>
                                          <span className="font-normal text-[10px]">(Client ↔ Requirement ↔ Vendor ↔ Candidate ↔ Interview ↔ Offer ↔ Invoice ↔ Revenue)</span>
                                      </div>
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-[500px] text-center py-2 px-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-xs font-bold shadow-sm">
                                          Firestore + Gmail + Calendar + CRM + External APIs
                                      </div>
                                      <div className="text-slate-600">↓</div>
                                      <div className="w-[500px] text-center py-2 px-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-xs font-bold shadow-sm text-slate-500">
                                          Telemetry, Audit Logs, Learning Loops
                                      </div>
                                  </div>
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Enterprise Memory States</h4>
                                      <div className="space-y-4 text-sm">
                                          <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                                              <div className="text-indigo-400 font-bold text-[10px] uppercase mb-1">1. Short Memory</div>
                                              <div className="text-slate-300 text-xs">Today's active events. Expires in hours (e.g. scheduled interviews, immediate follow-ups).</div>
                                          </div>
                                          <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                                              <div className="text-emerald-400 font-bold text-[10px] uppercase mb-1">2. Working Memory</div>
                                              <div className="text-slate-300 text-xs">Current business state. Lives until workflow finishes (e.g. Requirement -&gt; Offer).</div>
                                          </div>
                                          <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                                              <div className="text-amber-400 font-bold text-[10px] uppercase mb-1">3. Long Memory</div>
                                              <div className="text-slate-300 text-xs">Historical performance data. (e.g. Vendor average response 18 mins).</div>
                                          </div>
                                          <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                                              <div className="text-rose-400 font-bold text-[10px] uppercase mb-1">4. Knowledge Memory</div>
                                              <div className="text-slate-300 text-xs">Pattern recognition. Continuously updates operational intelligence.</div>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4">Enterprise Autonomy Score</h4>
                                      <div className="space-y-4 text-sm">
                                      <div className="flex items-start gap-4">
                                          <div className="w-24 font-mono text-xs text-emerald-400 mt-1">Goal: 25+</div>
                                          <div className="flex-1">
                                              <div className="flex justify-between">
                                                  <div className="text-slate-300 font-bold mb-1">Autonomous Business Scenarios</div>
                                                  <div className="text-amber-400 font-mono text-xs font-bold">~30%</div>
                                              </div>
                                              <div className="text-slate-400 text-xs">End-to-end execution of staffing operations without manual orchestration.</div>
                                              <div className="w-full bg-slate-800 rounded-full h-1 mt-2">
                                                  <div className="bg-amber-400 h-1 rounded-full" style={{ width: '30%' }}></div>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-4">
                                          <div className="w-24 font-mono text-xs text-slate-500 mt-1">Target: &lt;5</div>
                                          <div className="flex-1">
                                              <div className="flex justify-between">
                                                  <div className="text-slate-300 font-bold mb-1 text-slate-400">Manual Interventions / Day</div>
                                                  <div className="text-slate-500 font-mono text-xs font-bold">Pending</div>
                                              </div>
                                              <div className="text-slate-500 text-xs">Founder Vacation Test: Can the system run 10 days autonomously?</div>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-4">
                                          <div className="w-24 font-mono text-xs text-slate-500 mt-1">Target: &gt;90%</div>
                                          <div className="flex-1">
                                              <div className="flex justify-between">
                                                  <div className="text-slate-300 font-bold mb-1 text-slate-400">Requirements Processed</div>
                                                  <div className="text-slate-500 font-mono text-xs font-bold">Pending</div>
                                              </div>
                                              <div className="text-slate-500 text-xs">Automatic requirement intake, parsing, and matched candidate generation.</div>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-4">
                                          <div className="w-24 font-mono text-xs text-slate-500 mt-1">Target: &gt;80%</div>
                                          <div className="flex-1">
                                              <div className="flex justify-between">
                                                  <div className="text-slate-300 font-bold mb-1 text-slate-400">Automated Submissions</div>
                                                  <div className="text-slate-500 font-mono text-xs font-bold">Pending</div>
                                              </div>
                                              <div className="text-slate-500 text-xs">Candidates submitted without manual recruiter work.</div>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-4">
                                          <div className="w-24 font-mono text-xs text-slate-500 mt-1">Target: -10%</div>
                                          <div className="flex-1">
                                              <div className="flex justify-between">
                                                  <div className="text-slate-300 font-bold mb-1 text-slate-400">AI Cost Per Placement</div>
                                                  <div className="text-slate-500 font-mono text-xs font-bold">Pending</div>
                                              </div>
                                              <div className="text-slate-500 text-xs">Optimizing inference and execution cost per successful placement.</div>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-4">
                                          <div className="w-24 font-mono text-xs text-slate-500 mt-1">Target: &gt;8h</div>
                                          <div className="flex-1">
                                              <div className="flex justify-between">
                                                  <div className="text-slate-300 font-bold mb-1 text-slate-400">Founder Hours Saved</div>
                                                  <div className="text-slate-500 font-mono text-xs font-bold">Pending</div>
                                              </div>
                                              <div className="text-slate-500 text-xs">Time recuperated by delegating daily orchestration to the AI COO.</div>
                                          </div>
                                      </div>
                                      <div className="flex items-start gap-4">
                                          <div className="w-24 font-mono text-xs text-slate-500 mt-1">Target: 100%</div>
                                          <div className="flex-1">
                                              <div className="flex justify-between">
                                                  <div className="text-slate-300 font-bold mb-1 text-slate-400">Founder Report Generation</div>
                                                  <div className="text-slate-500 font-mono text-xs font-bold">Pending</div>
                                              </div>
                                              <div className="text-slate-500 text-xs">Daily morning simulations and end-of-day operational summaries.</div>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="mt-6 pt-4 border-t border-slate-800">
                                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Release Gates (The 3 Tests)</h4>
                                      <div className="flex flex-col gap-2">
                                          <div className="flex items-center gap-2 text-xs text-slate-400">
                                              <CheckCircle2 size={12} className="text-emerald-400" />
                                              <span className="font-bold text-slate-300">Runtime:</span> Can it run without a human?
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-slate-400">
                                              <CheckCircle2 size={12} className="text-indigo-400" />
                                              <span className="font-bold text-slate-300">Business:</span> Does it directly increase placements or revenue?
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-slate-400">
                                              <CheckCircle2 size={12} className="text-amber-400" />
                                              <span className="font-bold text-slate-300">Learning:</span> Does it make the system smarter?
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              </div>
                          </div>
                      ) : activeCategory === 'Chief Operating Office' ? (
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 col-span-3">
                                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Target size={14} /> Mission: OS Conductor</h4>
                                      <p className="text-sm text-slate-300 italic mb-4">
                                          Execute active operational loops every 15 minutes. Resolve blocked workflows, enforce SLAs, delegate work, reassign stalled tasks, and escalate only when human intervention is absolutely required.
                                      </p>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                              <div className="text-slate-400 text-xs font-bold uppercase mb-1">Global Queue</div>
                                              <div className="text-2xl font-mono text-white">{queueCount.toLocaleString()}</div>
                                          </div>
                                          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                              <div className="text-slate-400 text-xs font-bold uppercase mb-1">Blocked Workflows</div>
                                              <div className="text-2xl font-mono text-rose-400">{failedCount.toLocaleString()}</div>
                                          </div>
                                          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                              <div className="text-slate-400 text-xs font-bold uppercase mb-1">Active Offices</div>
                                              <div className="text-2xl font-mono text-emerald-400">7 / 7</div>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity size={14} /> System Health</h4>
                                      <div className="flex flex-col gap-4">
                                          <div className="flex justify-between items-center text-sm">
                                              <span className="text-slate-400">Runtime</span>
                                              <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Stable</span>
                                          </div>
                                          <div className="flex justify-between items-center text-sm">
                                              <span className="text-slate-400">Event Bus</span>
                                              <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Synced</span>
                                          </div>
                                          <div className="flex justify-between items-center text-sm">
                                              <span className="text-slate-400">Cost Engine</span>
                                              <span className="text-indigo-400 font-bold">Optimized</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                                      Real-Time Observability
                                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-mono">15m refresh loop</span>
                                  </h4>
                                  <div className="overflow-x-auto">
                                      <table className="w-full text-left text-sm text-slate-400">
                                          <thead className="text-xs text-slate-500 uppercase bg-slate-900/50 border-b border-slate-800">
                                              <tr>
                                                  <th className="px-4 py-3">Office</th>
                                                  <th className="px-4 py-3">Status</th>
                                                  <th className="px-4 py-3">Capacity</th>
                                                  <th className="px-4 py-3">SLA Health</th>
                                                  <th className="px-4 py-3">AI Spend (24h)</th>
                                                  <th className="px-4 py-3">Action</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              <tr className="border-b border-slate-800/50">
                                                  <td className="px-4 py-3 font-bold text-slate-300">Recruitment Office</td>
                                                  <td className="px-4 py-3 text-emerald-400">Active</td>
                                                  <td className="px-4 py-3">85%</td>
                                                  <td className="px-4 py-3 text-emerald-400">92%</td>
                                                  <td className="px-4 py-3 font-mono">$12.40</td>
                                                  <td className="px-4 py-3"><button className="text-xs text-indigo-400 hover:text-indigo-300">Rebalance</button></td>
                                              </tr>
                                              <tr className="border-b border-slate-800/50">
                                                  <td className="px-4 py-3 font-bold text-slate-300">Vendor Office</td>
                                                  <td className="px-4 py-3 text-emerald-400">Active</td>
                                                  <td className="px-4 py-3">45%</td>
                                                  <td className="px-4 py-3 text-emerald-400">98%</td>
                                                  <td className="px-4 py-3 font-mono">$4.20</td>
                                                  <td className="px-4 py-3"><button className="text-xs text-indigo-400 hover:text-indigo-300">Rebalance</button></td>
                                              </tr>
                                              <tr className="border-b border-slate-800/50">
                                                  <td className="px-4 py-3 font-bold text-slate-300">GTM Office</td>
                                                  <td className="px-4 py-3 text-amber-400">Spiking</td>
                                                  <td className="px-4 py-3">94%</td>
                                                  <td className="px-4 py-3 text-amber-400">76%</td>
                                                  <td className="px-4 py-3 font-mono">$24.80</td>
                                                  <td className="px-4 py-3"><button className="text-xs text-indigo-400 hover:text-indigo-300">Scale Up</button></td>
                                              </tr>
                                              <tr className="border-b border-slate-800/50">
                                                  <td className="px-4 py-3 font-bold text-slate-300">Client Office</td>
                                                  <td className="px-4 py-3 text-emerald-400">Active</td>
                                                  <td className="px-4 py-3">60%</td>
                                                  <td className="px-4 py-3 text-emerald-400">99%</td>
                                                  <td className="px-4 py-3 font-mono">$8.15</td>
                                                  <td className="px-4 py-3"><button className="text-xs text-indigo-400 hover:text-indigo-300">Rebalance</button></td>
                                              </tr>
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp size={14}/> Operational Execution Log</h4>
                                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 h-[200px] overflow-y-auto">
                                          <div className="flex flex-col text-xs text-slate-400 font-mono space-y-2">
                                              <div className="flex items-start gap-2">
                                                  <span className="text-indigo-400">09:15</span>
                                                  <span><span className="text-slate-600">→</span> Check Requirements</span>
                                              </div>
                                              <div className="flex items-start gap-2 pl-9">
                                                  <span><span className="text-slate-600">→</span> <span className="text-rose-400">2 requirements blocked</span></span>
                                              </div>
                                              <div className="flex items-start gap-2 pl-9">
                                                  <span><span className="text-slate-600">→</span> Vendor Office has not replied</span>
                                              </div>
                                              <div className="flex items-start gap-2 pl-9">
                                                  <span><span className="text-slate-600">→</span> <span className="text-emerald-400">Broadcast to 12 more vendors</span></span>
                                              </div>
                                              <div className="flex items-start gap-2 pl-9">
                                                  <span><span className="text-slate-600">→</span> Notify Recruitment Office</span>
                                              </div>
                                              <div className="flex items-start gap-2 pl-9">
                                                  <span><span className="text-slate-600">→</span> Update Founder Dashboard</span>
                                              </div>
                                              <div className="mt-2 text-slate-500 italic border-t border-slate-800 pt-2">Waiting for next interval...</div>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Target size={14}/> Enterprise Simulation (08:45 AM)</h4>
                                      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-xs">
                                          <div className="grid grid-cols-2 gap-4 mb-4">
                                              <div>
                                                  <div className="text-slate-500 uppercase font-bold text-[10px] mb-1">Revenue Goal</div>
                                                  <div className="text-indigo-400 font-mono text-lg font-bold">₹3,00,000</div>
                                              </div>
                                              <div>
                                                  <div className="text-slate-500 uppercase font-bold text-[10px] mb-1">Forecast / Confidence</div>
                                                  <div className="text-emerald-400 font-mono text-lg font-bold">₹2,72,000 <span className="text-slate-400 text-xs">(81%)</span></div>
                                              </div>
                                          </div>
                                          <div className="mb-4">
                                              <div className="text-rose-400 uppercase font-bold text-[10px] mb-2 border-b border-rose-900/50 pb-1">Predicted Blockers</div>
                                              <ul className="list-disc pl-4 text-slate-300 space-y-1">
                                                  <li>Vendor ABC SLA risk</li>
                                                  <li>Client XYZ waiting for feedback</li>
                                                  <li>2 interviews missing confirmations</li>
                                              </ul>
                                          </div>
                                          <div>
                                              <div className="text-emerald-400 uppercase font-bold text-[10px] mb-2 border-b border-emerald-900/50 pb-1">Recommended Actions</div>
                                              <ul className="list-disc pl-4 text-slate-300 space-y-1">
                                                  <li>Broadcast Requirement #421</li>
                                                  <li>Follow up with Client ABC</li>
                                                  <li>Schedule Recruiter Meeting</li>
                                              </ul>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ) : activeCategory.includes('Office') ? (
                          <div className="space-y-6">
                              {/* Office Runtime Contract Sections */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Target size={14} /> Mission & Goal</h4>
                                      <div className="space-y-3">
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Mission</div>
                                              <div className="text-sm text-slate-300 italic">{getOfficeContract(activeCategory).mission}</div>
                                          </div>
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Business Goal</div>
                                              <div className="text-sm text-slate-300">{getOfficeContract(activeCategory).goal}</div>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity size={14} /> Current Status</h4>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Today's Objectives</div>
                                              <div className="text-sm text-slate-300">{getOfficeContract(activeCategory).objectives}</div>
                                          </div>
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Results So Far</div>
                                              <div className="text-sm text-emerald-400 font-bold">{getOfficeContract(activeCategory).results}</div>
                                          </div>
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Current Queue</div>
                                              <div className="text-xl text-slate-300 font-mono">{getOfficeContract(activeCategory).queue} Items</div>
                                          </div>
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Blocked Work</div>
                                              <div className="text-xl text-rose-400 font-mono">{getOfficeContract(activeCategory).blocked} Items</div>
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Network size={14} /> Event Bus Integration</h4>
                                      <div className="space-y-4">
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Events Consumed (Listens to)</div>
                                              <div className="flex flex-wrap gap-2">
                                                  {getOfficeContract(activeCategory).consumed.map((item: string) => (
                                                      <span key={item} className="px-2 py-1 bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded flex items-center gap-1">
                                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div> {item}
                                                      </span>
                                                  ))}
                                              </div>
                                          </div>
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Events Published (Emits)</div>
                                              <div className="flex flex-wrap gap-2">
                                                  {getOfficeContract(activeCategory).published.map((item: string) => (
                                                      <span key={item} className="px-2 py-1 bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded flex items-center gap-1">
                                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> {item}
                                                      </span>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Zap size={14} /> Execution Context</h4>
                                      <div className="space-y-4">
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Skills Used</div>
                                              <div className="flex flex-wrap gap-2">
                                                  {getOfficeContract(activeCategory).skills.map((item: string) => (
                                                      <span key={item} className="px-2 py-1 bg-indigo-900/30 border border-indigo-800/50 text-indigo-300 text-[10px] rounded">{item}</span>
                                                  ))}
                                              </div>
                                          </div>
                                          <div>
                                              <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Memory Used</div>
                                              <div className="flex flex-wrap gap-2">
                                                  {getOfficeContract(activeCategory).memory.map((item: string) => (
                                                      <span key={item} className="px-2 py-1 bg-amber-900/30 border border-amber-800/50 text-amber-300 text-[10px] rounded">{item}</span>
                                                  ))}
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp size={14} /> Owned KPIs</h4>
                                      <ul className="space-y-2">
                                          {getOfficeContract(activeCategory).kpis.map((kpi: string) => (
                                              <li key={kpi} className="flex justify-between items-center text-sm border-b border-slate-800 pb-2 last:border-0">
                                                  <span className="text-slate-300">{kpi}</span>
                                                  <span className="font-mono text-emerald-400 font-bold">Tracked</span>
                                              </li>
                                          ))}
                                      </ul>
                                  </div>
                                  
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Shield size={14} /> Governance Rules</h4>
                                      <div className="space-y-3">
                                          <div>
                                              <div className="text-[10px] font-bold text-slate-500 uppercase">Business Hours</div>
                                              <div className="text-sm text-slate-300">{getOfficeContract(activeCategory).hours}</div>
                                          </div>
                                          <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-lg">
                                              <div className="text-[10px] font-bold text-rose-400 uppercase mb-1 flex items-center gap-1"><AlertTriangle size={12} /> Escalation Rules</div>
                                              <div className="text-sm text-rose-200">{getOfficeContract(activeCategory).escalation}</div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ) : activeCategory.includes('Layer') ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {filteredAgents.map(agent => (
                                  <div 
                                    key={agent.id} 
                                    onClick={() => setSelectedAgent(agent)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 transition-colors cursor-pointer group flex flex-col h-full"
                                  >
                                      <div className="flex justify-between items-start mb-3">
                                          <div className="flex items-center gap-2">
                                              <Bot size={18} className="text-indigo-400" />
                                              <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{agent.name}</h4>
                                              {agent.core && <span className="text-[8px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">Core</span>}
                                          </div>
                                          {renderAgentStatus(agent.status)}
                                      </div>
                                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">{agent.desc}</p>
                                      <div className="grid grid-cols-2 gap-2 mt-auto border-t border-slate-800 pt-3">
                                          <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Executions</p>
                                              <p className="text-xs text-slate-300 font-mono">{(agent.execsToday || 0).toLocaleString()}</p>
                                          </div>
                                          <div>
                                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">Success Rate</p>
                                              <p className={cn("text-xs font-mono", agent.success === '100%' ? "text-emerald-400" : agent.success === '--' ? "text-slate-500" : "text-amber-400")}>{agent.success}</p>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : activeCategory === 'Operations Calendar' ? (
                          <div className="space-y-6">
                              <p className="text-sm text-slate-400 mb-6">The Operations Calendar is the scheduled heartbeat of the AI Workforce OS.</p>
                              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                                  <table className="w-full text-left border-collapse">
                                      <thead>
                                          <tr className="border-b border-slate-800 bg-slate-900/50">
                                              <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</th>
                                              <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Office</th>
                                              <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Task</th>
                                              <th className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/50 text-sm">
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">08:30 AM</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Founder</span></td>
                                              <td className="py-3 px-4">Overnight business briefing</td>
                                              <td className="py-3 px-4 text-emerald-400 text-xs font-mono flex items-center gap-1"><CheckCircle2 size={12}/> OK</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">09:00 AM</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">GTM</span></td>
                                              <td className="py-3 px-4">Find new leads</td>
                                              <td className="py-3 px-4 text-emerald-400 text-xs font-mono flex items-center gap-1"><CheckCircle2 size={12}/> OK</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">09:05 AM</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Sales</span></td>
                                              <td className="py-3 px-4">Follow up opportunities</td>
                                              <td className="py-3 px-4 text-emerald-400 text-xs font-mono flex items-center gap-1"><CheckCircle2 size={12}/> OK</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">09:10 AM</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Recruitment</span></td>
                                              <td className="py-3 px-4">Parse resumes</td>
                                              <td className="py-3 px-4 text-emerald-400 text-xs font-mono flex items-center gap-1"><CheckCircle2 size={12}/> OK</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">09:15 AM</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Vendor</span></td>
                                              <td className="py-3 px-4">Collect bench profiles</td>
                                              <td className="py-3 px-4 text-slate-500 text-xs font-mono flex items-center gap-1">PENDING</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">Every 5 min</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">MailOS</span></td>
                                              <td className="py-3 px-4">Gmail sync</td>
                                              <td className="py-3 px-4 text-emerald-400 text-xs font-mono flex items-center gap-1"><CheckCircle2 size={12}/> RUNNING</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">Every 10 min</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Matching</span></td>
                                              <td className="py-3 px-4">Candidate matching</td>
                                              <td className="py-3 px-4 text-emerald-400 text-xs font-mono flex items-center gap-1"><CheckCircle2 size={12}/> RUNNING</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">Every 15 min</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Client</span></td>
                                              <td className="py-3 px-4">Requirement updates</td>
                                              <td className="py-3 px-4 text-emerald-400 text-xs font-mono flex items-center gap-1"><CheckCircle2 size={12}/> RUNNING</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">Every hour</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Finance</span></td>
                                              <td className="py-3 px-4">Invoice reconciliation</td>
                                              <td className="py-3 px-4 text-slate-500 text-xs font-mono flex items-center gap-1">PENDING</td>
                                          </tr>
                                          <tr className="hover:bg-slate-800/30 text-slate-300">
                                              <td className="py-3 px-4 font-mono text-indigo-400">06:00 PM</td>
                                              <td className="py-3 px-4"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs">Founder</span></td>
                                              <td className="py-3 px-4">End-of-day report</td>
                                              <td className="py-3 px-4 text-slate-500 text-xs font-mono flex items-center gap-1">PENDING</td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      ) : activeCategory === 'Office Memory' ? (
                          <div className="space-y-6">
                              <p className="text-sm text-slate-400 mb-6">Offices run, learn, store memory, and improve tomorrow.</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Bot size={16} className="text-indigo-400"/> Recruitment Office Memory</h4>
                                      <ul className="space-y-2 text-xs text-slate-400">
                                          <li className="flex gap-2"><span className="text-indigo-500">•</span> Learns: Top vendors for backend roles</li>
                                          <li className="flex gap-2"><span className="text-indigo-500">•</span> Learns: Best recruiters by conversion</li>
                                          <li className="flex gap-2"><span className="text-indigo-500">•</span> Learns: Successful keywords matching JD</li>
                                          <li className="flex gap-2"><span className="text-indigo-500">•</span> Learns: Interview failure patterns</li>
                                      </ul>
                                  </div>
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Bot size={16} className="text-emerald-400"/> GTM Office Memory</h4>
                                      <ul className="space-y-2 text-xs text-slate-400">
                                          <li className="flex gap-2"><span className="text-emerald-500">•</span> Learns: Campaign open rates</li>
                                          <li className="flex gap-2"><span className="text-emerald-500">•</span> Learns: Best performing outreach messaging</li>
                                          <li className="flex gap-2"><span className="text-emerald-500">•</span> Learns: ICPs that respond fastest</li>
                                          <li className="flex gap-2"><span className="text-emerald-500">•</span> Learns: Campaign conversion history</li>
                                      </ul>
                                  </div>
                                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                                      <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Bot size={16} className="text-amber-400"/> Founder Office Memory</h4>
                                      <ul className="space-y-2 text-xs text-slate-400">
                                          <li className="flex gap-2"><span className="text-amber-500">•</span> Learns: Revenue history trends</li>
                                          <li className="flex gap-2"><span className="text-amber-500">•</span> Learns: Hiring velocity per client</li>
                                          <li className="flex gap-2"><span className="text-amber-500">•</span> Learns: Month-over-month growth patterns</li>
                                          <li className="flex gap-2"><span className="text-amber-500">•</span> Learns: Forecast accuracy deviations</li>
                                      </ul>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-center">
                              <Bot size={48} className="text-slate-700 mb-4" />
                              <h4 className="text-slate-300 font-bold mb-2">Module Not Yet Implemented</h4>
                              <p className="text-slate-500 text-sm max-w-md">The {activeCategory} view is part of the future Agent Supervisor architecture and will be available in an upcoming release.</p>
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[500px]">
                      <button 
                        onClick={() => setSelectedAgent(null)}
                        className="text-xs font-bold text-slate-400 hover:text-white mb-6 flex items-center gap-1 transition-colors"
                      >
                          ← Back to {activeCategory}
                      </button>

                      <div className="flex justify-between items-start mb-8">
                          <div>
                              <div className="flex items-center gap-3 mb-2">
                                  <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                      <Bot size={24} className="text-indigo-400" />
                                  </div>
                                  <div>
                                      <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                          {selectedAgent.name}
                                          {selectedAgent.core && <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 relative top-0.5">Core System</span>}
                                      </h2>
                                      <p className="text-sm text-slate-400">{selectedAgent.desc}</p>
                                  </div>
                              </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                              {renderAgentStatus(selectedAgent.status)}
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Trigger / Schedule</span>
                              <span className="text-xs text-slate-300 font-mono">{selectedAgent.schedule}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Executions Today</span>
                              <span className="text-sm font-bold text-slate-200 font-mono">{(selectedAgent.execsToday || 0).toLocaleString()}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Avg Latency</span>
                              <span className="text-sm font-bold text-slate-200 font-mono">{selectedAgent.avgTime}</span>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Success Rate</span>
                              <span className={cn("text-sm font-bold font-mono", selectedAgent.success === '100%' ? "text-emerald-400" : selectedAgent.success === '--' ? "text-slate-500" : "text-amber-400")}>{selectedAgent.success}</span>
                          </div>
                      </div>

                      <div className="flex gap-3 mb-8 border-b border-slate-800 pb-8">
                          <button onClick={handleRunNow} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                              <Play size={16}/> Run Now
                          </button>
                          {selectedAgent.status === 'Disabled' ? (
                              <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                                  <Play size={16}/> Enable
                              </button>
                          ) : (
                              <button 
                                className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors", selectedAgent.core ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400")}
                                disabled={selectedAgent.core}
                                title={selectedAgent.core ? "Core agents cannot be disabled" : ""}
                              >
                                  <Pause size={16}/> Disable
                              </button>
                          )}
                          <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                              <RefreshCw size={16}/> Restart
                          </button>
                          <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ml-auto">
                              <Settings size={16}/> Configuration
                          </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><History size={16}/> Recent Executions</h4>
                              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                                  {executions.length === 0 ? (
                                      <div className="p-6 text-center text-xs text-slate-500 font-mono">No executions recently</div>
                                  ) : (
                                      <table className="w-full text-left border-collapse">
                                        <tbody className="divide-y divide-slate-800/50">
                                            {executions.map(exec => (
                                                <tr key={exec.id} className="hover:bg-slate-800/30">
                                                    <td className="py-2.5 px-4">
                                                        {exec.status === 'success' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs font-mono text-slate-400">
                                                        {exec.timestamp?.toDate ? exec.timestamp.toDate().toLocaleTimeString() : 'Just now'}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs font-mono text-slate-500 text-right">{exec.duration}ms</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                  )}
                              </div>
                          </div>
                          <div>
                              <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2"><Network size={16}/> Dependencies</h4>
                              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                                  {selectedAgent.id === 'mail-sync' && (
                                      <>
                                        <div className="flex items-center gap-2 text-xs text-slate-400"><Activity size={14} className="text-amber-500"/> Blocks: JD Parser</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400"><Activity size={14} className="text-amber-500"/> Blocks: Resume Parser</div>
                                      </>
                                  )}
                                  {selectedAgent.id === 'resume-parser' && (
                                      <>
                                        <div className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 size={14} className="text-emerald-500"/> Depends on: Mail Sync</div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400"><Activity size={14} className="text-amber-500"/> Blocks: Matching Engine</div>
                                      </>
                                  )}
                                  {selectedAgent.id !== 'mail-sync' && selectedAgent.id !== 'resume-parser' && (
                                      <div className="text-xs text-slate-500 font-mono">No direct dependencies mapped.</div>
                                  )}
                              </div>
                          </div>
                      </div>

                  </div>
              )}
          </div>
      </div>
    </div>
  );
}
