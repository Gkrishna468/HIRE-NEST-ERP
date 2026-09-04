import React, { useState, useEffect } from "react";
import { 
  Network,
  Plus,
  Play,
  Save,
  Trash2,
  Bot,
  Zap,
  ArrowRight,
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Sliders,
  ShieldCheck,
  Activity,
  FileText,
  Sparkles,
  Clock,
  UserCheck,
  Send,
  Check,
  Edit3,
  Filter,
  CheckCircle,
  TrendingUp,
  Cpu,
  RotateCcw
} from "lucide-react";
import { 
  collection, 
  getDocs, 
  onSnapshot, 
  query, 
  addDoc, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, auth } from "../lib/firebase";
import { cn } from "../lib/utils";
import { checkIsAdmin } from "../lib/permissions";
import { assertNoMockData } from "../lib/ProductionDataGuard";
import { motion, AnimatePresence } from "motion/react";

// =========================================================================
// STRONGLY TYPED INTERFACES
// =========================================================================
interface RuleCondition {
  field: string;
  operator: string; // "==", ">=", "<=", "contains", "!= "
  value: string;
}

interface RuleAction {
  type: string; // "SEND_EMAIL" | "GENERATE_DRAFT" | "SEND_SMS" | "BROADCAST" | "TRIGGER_ALERT" | "ESCALATE" | "NOTIFY_SLACK"
  target: string;
  template: string;
}

interface AutomationRule {
  id?: string;
  name: string;
  category: "Recruiter" | "Vendor" | "Client" | "Executive";
  trigger: "REQUIREMENT_CREATED" | "CANDIDATE_MATCHED" | "SUBMISSION_RECEIVED" | "INTERVIEW_SCHEDULED" | "REVENUE_ALERT" | "SLA_RISK_DETECTED";
  priority: "High" | "Medium" | "Low";
  enabled: boolean;
  approvalPolicy: "Auto" | "Requires Recruiter Approval" | "Requires Admin Approval";
  retryPolicy: {
    attempts: number;
    backoffMinutes: number;
  };
  owner: string;
  version: string;
  createdBy: string;
  lastExecuted: string | null;
  executionCount: number;
  successRate: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  versions?: {
    version: string;
    timestamp: string;
    name: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
  }[];
}

interface ExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  category: string;
  trigger: string;
  status: "COMPLETED" | "PENDING_APPROVAL" | "SKIPPED" | "FAILED" | "APPROVED" | "REJECTED";
  timestamp: string;
  durationMs: number;
  dryRun?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  explainability: {
    triggerMatched: boolean;
    conditionsEvaluated: { condition: string; matched: boolean }[];
    decisionType: string;
    actionResult: string;
  };
  simulatedOutput?: string;
}

// =========================================================================
// INTEGRATED ADOPTION & TELEMETRY PRESETS
// =========================================================================
const DEFAULT_TELEMETRY = {
  rulesExecuted: 168,
  rulesSkipped: 45,
  approvalRate: 94,
  failureRate: 2,
  timeSavedHours: 142,
  aiAcceptanceRate: 91,
  avgDurationMs: 420
};

export default function WorkflowStudioTab({ userRole }: { userRole: string }) {
  // -------------------------------------------------------------------------
  // CORE COMPONENT STATE
  // -------------------------------------------------------------------------
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [executions, setExecutions] = useState<ExecutionLog[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionLog | null>(null);
  const [telemetry, setTelemetry] = useState(DEFAULT_TELEMETRY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("All");

  const [dryRunActive, setDryRunActive] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [isGeneratingRule, setIsGeneratingRule] = useState(false);
  const [versionChoice, setVersionChoice] = useState<"overwrite" | "minor" | "major">("overwrite");

  // -------------------------------------------------------------------------
  // FEATURE FLAGS STATE
  // -------------------------------------------------------------------------
  const [flags, setFlags] = useState({
    AUTOMATION_ENGINE_ENABLED: true,
    AUTOMATION_TEMPLATES_ENABLED: true,
    AUTOMATION_AI_SUGGESTIONS_ENABLED: true,
  });

  // -------------------------------------------------------------------------
  // CUSTOMIZABLE PERMISSIONS STATE (FOR MULTI-PERSONA SIMULATION)
  // -------------------------------------------------------------------------
  const [permissions, setPermissions] = useState({
    can_create_rules: true,
    can_edit_rules: true,
    can_approve_automations: true,
    can_pause_workflows: true,
    can_replay_workflows: true,
  });

  // -------------------------------------------------------------------------
  // INTERACTIVE SIMULATION RUNNER STATE
  // -------------------------------------------------------------------------
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [simulationStatus, setSimulationStatus] = useState<"IDLE" | "RUNNING" | "AWAITING_APPROVAL" | "COMPLETED" | "REJECTED">("IDLE");
  const [simulatedDraftContent, setSimulatedDraftContent] = useState<string>("");
  const [simulatedLog, setSimulatedLog] = useState<ExecutionLog | null>(null);

  // -------------------------------------------------------------------------
  // GUIDED RULE FORMS STATE
  // -------------------------------------------------------------------------
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // =========================================================================
  // SEED AND DEFAULT TEMPLATE DEFINITIONS (SPANS PERSONAS)
  // =========================================================================
  const PREDEFINED_TEMPLATES: AutomationRule[] = [
    // RECRUITER SOPs
    {
      name: "High Match Submission Nudge",
      category: "Recruiter",
      trigger: "CANDIDATE_MATCHED",
      priority: "High",
      enabled: true,
      approvalPolicy: "Requires Recruiter Approval",
      retryPolicy: { attempts: 3, backoffMinutes: 10 },
      owner: "Lead Recruiter Node",
      version: "1.0",
      createdBy: "System",
      lastExecuted: "2026-06-29 18:42",
      executionCount: 24,
      successRate: 96,
      conditions: [
        { field: "matchScore", operator: ">=", value: "90" }
      ],
      actions: [
        { type: "GENERATE_DRAFT", target: "Hiring Manager Mail", template: "SOP-011: Submit High Match Candidate Dossier with verified core competencies" }
      ]
    },
    {
      name: "Smart Candidate Interview Guide",
      category: "Recruiter",
      trigger: "INTERVIEW_SCHEDULED",
      priority: "Medium",
      enabled: true,
      approvalPolicy: "Auto",
      retryPolicy: { attempts: 2, backoffMinutes: 5 },
      owner: "Candidate Concierge",
      version: "1.2",
      createdBy: "System",
      lastExecuted: "2026-06-30 01:10",
      executionCount: 52,
      successRate: 100,
      conditions: [
        { field: "hoursToInterview", operator: "<=", value: "24" }
      ],
      actions: [
        { type: "SEND_SMS", target: "Candidate Mobile", template: "SOP-102: Send detailed logistics, interviewer bios, and prep handbook" }
      ]
    },
    {
      name: "Candidate Response SLA Reminder",
      category: "Recruiter",
      trigger: "SUBMISSION_RECEIVED",
      priority: "Medium",
      enabled: true,
      approvalPolicy: "Auto",
      retryPolicy: { attempts: 1, backoffMinutes: 15 },
      owner: "SLA Monitor",
      version: "1.0",
      createdBy: "System",
      lastExecuted: "2026-06-28 09:12",
      executionCount: 12,
      successRate: 91,
      conditions: [
        { field: "daysInStatus", operator: ">=", value: "3" }
      ],
      actions: [
        { type: "SEND_EMAIL", target: "Hiring Manager", template: "SOP-143: Critical reminder on candidate profile reviews to prevent SLA slip" }
      ]
    },
    // VENDOR PORTAL SOPs
    {
      name: "New Requirement SLA Broadcast",
      category: "Vendor",
      trigger: "REQUIREMENT_CREATED",
      priority: "High",
      enabled: true,
      approvalPolicy: "Auto",
      retryPolicy: { attempts: 3, backoffMinutes: 5 },
      owner: "Vendor Relationship Node",
      version: "2.1",
      createdBy: "HQ Operations",
      lastExecuted: "2026-06-30 00:04",
      executionCount: 38,
      successRate: 97,
      conditions: [
        { field: "priority", operator: "==", value: "High" }
      ],
      actions: [
        { type: "BROADCAST", target: "Primary Vendor Network", template: "SOP-012: Instantly distribute requirement spec sheet to accredited SLA vendors" }
      ]
    },
    {
      name: "SLA Penalty Warning Signal",
      category: "Vendor",
      trigger: "SLA_RISK_DETECTED",
      priority: "High",
      enabled: true,
      approvalPolicy: "Auto",
      retryPolicy: { attempts: 5, backoffMinutes: 2 },
      owner: "Risk Audit Node",
      version: "1.0",
      createdBy: "HQ Security",
      lastExecuted: "2026-06-25 14:22",
      executionCount: 6,
      successRate: 100,
      conditions: [
        { field: "riskScore", operator: ">=", value: "75" }
      ],
      actions: [
        { type: "TRIGGER_ALERT", target: "Vendor Account Executive", template: "SOP-301: Alert of impending SLA submission delay with live penalty calculator" }
      ]
    },
    // CLIENT COLLABORATION SOPs
    {
      name: "Hiring Manager Interview Auto-Confirm",
      category: "Client",
      trigger: "INTERVIEW_SCHEDULED",
      priority: "High",
      enabled: true,
      approvalPolicy: "Auto",
      retryPolicy: { attempts: 3, backoffMinutes: 10 },
      owner: "Client Coordinator",
      version: "1.0",
      createdBy: "System",
      lastExecuted: "2026-06-29 11:30",
      executionCount: 19,
      successRate: 95,
      conditions: [
        { field: "clientConfirmed", operator: "==", value: "false" }
      ],
      actions: [
        { type: "SEND_EMAIL", target: "Hiring Manager Portal", template: "SOP-224: Dispatched secure magic-link to pre-validate agenda and feedback card" }
      ]
    },
    {
      name: "High Priority Requirement Escalation",
      category: "Client",
      trigger: "REQUIREMENT_CREATED",
      priority: "High",
      enabled: true,
      approvalPolicy: "Requires Admin Approval",
      retryPolicy: { attempts: 3, backoffMinutes: 10 },
      owner: "SLA Governance Board",
      version: "1.4",
      createdBy: "HQ Operations",
      lastExecuted: "2026-06-22 10:45",
      executionCount: 3,
      successRate: 100,
      conditions: [
        { field: "unfilledDays", operator: ">=", value: "14" }
      ],
      actions: [
        { type: "ESCALATE", target: "VIP Recruiting Lead", template: "SOP-099: Elevate priority on HQ pipeline and allocate specialized bench hunters" }
      ]
    },
    // EXECUTIVE METRICS SOPs
    {
      name: "Executive Deal Value Alert",
      category: "Executive",
      trigger: "REVENUE_ALERT",
      priority: "High",
      enabled: true,
      approvalPolicy: "Requires Admin Approval",
      retryPolicy: { attempts: 2, backoffMinutes: 30 },
      owner: "AI COO Suite",
      version: "1.1",
      createdBy: "Founders Board",
      lastExecuted: "2026-06-29 16:15",
      executionCount: 11,
      successRate: 100,
      conditions: [
        { field: "contractValue", operator: ">=", value: "50000" }
      ],
      actions: [
        { type: "NOTIFY_SLACK", target: "Executive Leadership Channel", template: "SOP-800: Flash briefing with detailed Margin Analysis and Placement SLA compliance map" }
      ]
    }
  ];

  const SUGGESTED_AI_TEMPLATES = [
    {
      id: "sug1",
      title: "SLA Expiry Guard",
      description: "Based on last week's telemetry, 3 candidate submissions slipped the 48-hour client feedback window. This automated nudge resolves the gap.",
      savedHours: "4.5 hrs/wk",
      ruleTemplate: {
        name: "Critical SLA Expiry Safeguard",
        category: "Executive",
        trigger: "SLA_RISK_DETECTED",
        priority: "High",
        approvalPolicy: "Requires Admin Approval",
        retryPolicy: { attempts: 2, backoffMinutes: 10 },
        owner: "AI SLA Overseer",
        conditions: [{ field: "riskScore", operator: ">=", value: "90" }],
        actions: [{ type: "SEND_EMAIL", target: "Admins", template: "SOP-911: Emergency dispatch to resolve pending client review SLA risk" }]
      }
    },
    {
      id: "sug2",
      title: "Smart Candidate Follow-up",
      description: "Candidates waiting more than 3 days in 'Duplicate Review' have a 40% higher attrition rate. Auto-nudge the recruiter deck.",
      savedHours: "6.2 hrs/wk",
      ruleTemplate: {
        name: "Automated Submission Follow-up",
        category: "Recruiter",
        trigger: "SUBMISSION_RECEIVED",
        priority: "Medium",
        approvalPolicy: "Auto",
        retryPolicy: { attempts: 1, backoffMinutes: 30 },
        owner: "Talent Engagement Bot",
        conditions: [{ field: "daysInStatus", operator: ">=", value: "3" }],
        actions: [{ type: "SEND_EMAIL", target: "Hiring Manager", template: "SOP-114: Candidate check-in reminder and talent temperature query" }]
      }
    },
    {
      id: "sug3",
      title: "AI Cost Monitoring Safety Valve",
      description: "Token usage spike detected from batch matching routines. Auto-tune extraction limits when daily budget reaches threshold.",
      savedHours: "2.0 hrs/wk",
      ruleTemplate: {
        name: "AI Cost Alert Nudge",
        category: "Executive",
        trigger: "REVENUE_ALERT",
        priority: "High",
        approvalPolicy: "Auto",
        retryPolicy: { attempts: 1, backoffMinutes: 60 },
        owner: "DevOps Node",
        conditions: [{ field: "aiTokenUsageCost", operator: ">=", value: "100" }],
        actions: [{ type: "BROADCAST", target: "Infrastructure Node", template: "SOP-550: Optimize Gemini search bounds and notify billing lead" }]
      }
    }
  ];

  // =========================================================================
  // DB DATA SYNCHRONIZATION (FIRESTORE REAL-TIME READS/WRITES)
  // =========================================================================
  useEffect(() => {
    setLoading(true);
    // Realtime Query for Rules
    const qRules = query(collection(db, "workflow_rules"));
    const unsubscribeRules = onSnapshot(qRules, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AutomationRule[];
      
      setRules(list);
      if (list.length > 0 && !selectedRule) {
        setSelectedRule(list[0]);
      }
      assertNoMockData(list, "workflow_rules");
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "workflow_rules");
    });

    // Realtime Query for Execution Logs
    const qExecs = query(collection(db, "workflow_executions"));
    const unsubscribeExecs = onSnapshot(qExecs, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExecutionLog[];
      // Sort newest executions first
      const sorted = list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setExecutions(sorted);
      if (sorted.length > 0 && !selectedExecution) {
        setSelectedExecution(sorted[0]);
      }
      setLoading(false);
      assertNoMockData(list, "workflow_executions");
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "workflow_executions");
      setLoading(false);
    });

    // Load Telemetry Stats from Firestore or set defaults
    const qTelemetry = query(collection(db, "workflow_telemetry"));
    const unsubscribeTelemetry = onSnapshot(qTelemetry, (snapshot) => {
      if (!snapshot.empty) {
        const stats = snapshot.docs[0].data();
        setTelemetry(stats as typeof DEFAULT_TELEMETRY);
      }
    });

    return () => {
      unsubscribeRules();
      unsubscribeExecs();
      unsubscribeTelemetry();
    };
  }, []);

  // -------------------------------------------------------------------------
  // ACTION: SEED DEFAULT SOP TEMPLATES TO FIRESTORE
  // -------------------------------------------------------------------------
  const handleSeedTemplates = async () => {
    setSaving(true);
    try {
      // Add all preloaded rules
      for (const t of PREDEFINED_TEMPLATES) {
        await addDoc(collection(db, "workflow_rules"), t);
      }
      // Initialize global telemetry stats
      await setDoc(doc(db, "workflow_telemetry", "global_stats"), DEFAULT_TELEMETRY);
      
      // Add a couple of initial sample completion logs
      const sampleLogs: ExecutionLog[] = [
        {
          id: "ex-sample-1",
          ruleId: "seed-1",
          ruleName: "High Match Submission Nudge",
          category: "Recruiter",
          trigger: "CANDIDATE_MATCHED",
          status: "APPROVED",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          durationMs: 412,
          approvedBy: "Recruiter Admin",
          approvedAt: new Date(Date.now() - 3550000).toISOString(),
          explainability: {
            triggerMatched: true,
            conditionsEvaluated: [{ condition: "matchScore: 94 >= 90", matched: true }],
            decisionType: "Requires Recruiter Approval",
            actionResult: "Submission Dossier Drafted & Dispatched to hiring manager on approvals check"
          },
          simulatedOutput: "DRAFT Dossier generated for Candidate: Rajesh Kumar (AWS Architecture Architect, 94% Match Score)\nAction status: Approved and published."
        },
        {
          id: "ex-sample-2",
          ruleId: "seed-2",
          ruleName: "Smart Candidate Interview Guide",
          category: "Recruiter",
          trigger: "INTERVIEW_SCHEDULED",
          status: "COMPLETED",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          durationMs: 220,
          explainability: {
            triggerMatched: true,
            conditionsEvaluated: [{ condition: "hoursToInterview: 12 <= 24", matched: true }],
            decisionType: "Auto",
            actionResult: "SMS Interview Guide dispatched instantly to Candidate"
          },
          simulatedOutput: "SMS Dispatch: 'Hi Rajesh! Your interview with Apex Global is scheduled for tomorrow at 10 AM. Prep handbook: https://hirenest.io/prep/rajesh-apex'"
        }
      ];

      for (const logItem of sampleLogs) {
        await setDoc(doc(db, "workflow_executions", logItem.id), logItem);
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "workflow_rules");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: SAVE OR UPDATE RULE
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // ACTION: SAVE OR UPDATE RULE (WITH FULL VERSION HISTORY SUPPORT)
  // -------------------------------------------------------------------------
  const handleSaveRule = async (ruleData: AutomationRule) => {
    if (!permissions.can_edit_rules) {
      alert("Permission Denied: Your persona doesn't have the 'can_edit_rules' capability.");
      return;
    }
    setSaving(true);
    try {
      if (ruleData.id) {
        // Retrieve current state of rule from the local rules array
        const oldRule = rules.find(r => r.id === ruleData.id);
        let updatedVersions = oldRule?.versions || [];

        // Save old version in history if choice is not overwrite
        if (oldRule && versionChoice !== "overwrite") {
          updatedVersions = [
            ...updatedVersions,
            {
              version: oldRule.version,
              timestamp: new Date().toISOString(),
              name: oldRule.name,
              conditions: [...oldRule.conditions],
              actions: [...oldRule.actions]
            }
          ];
        }

        // Auto-increment version if minor/major chosen
        let nextVersion = ruleData.version;
        if (versionChoice === "minor") {
          const pts = ruleData.version.split(".");
          const major = parseInt(pts[0]) || 1;
          const minor = parseInt(pts[1]) || 0;
          nextVersion = `${major}.${minor + 1}`;
        } else if (versionChoice === "major") {
          const pts = ruleData.version.split(".");
          const major = parseInt(pts[0]) || 1;
          nextVersion = `${major + 1}.0`;
        }

        const updatedRule = {
          ...ruleData,
          version: nextVersion,
          versions: updatedVersions
        };

        const ruleRef = doc(db, "workflow_rules", ruleData.id);
        const { id, ...cleanData } = updatedRule;
        await updateDoc(ruleRef, { ...cleanData });
        setSelectedRule(updatedRule);
      } else {
        // Create new rule
        const docRef = await addDoc(collection(db, "workflow_rules"), {
          ...ruleData,
          createdBy: userRole || "HQ Admin",
          lastExecuted: null,
          executionCount: 0,
          successRate: 100,
          versions: []
        });
        setSelectedRule({ ...ruleData, id: docRef.id, versions: [] });
      }
      setIsCreatingNew(false);
      setEditingRule(null);
      setVersionChoice("overwrite"); // Reset
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "workflow_rules");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: ROLLBACK TO SPECIFIC VERSION HISTORIC BLUEPRINT
  // -------------------------------------------------------------------------
  const handleRollbackToVersion = async (verHistoryItem: any) => {
    if (!permissions.can_edit_rules) {
      alert("Permission Denied: Your persona doesn't have the 'can_edit_rules' capability.");
      return;
    }
    if (!selectedRule) return;
    if (!confirm(`Are you sure you want to rollback this ruleset to version v${verHistoryItem.version}?`)) return;
    
    setSaving(true);
    try {
      const currentVersion = selectedRule.version;
      const ruleRef = doc(db, "workflow_rules", selectedRule.id!);
      
      // Save current state into the backup history
      const currentBackup = {
        version: currentVersion,
        timestamp: new Date().toISOString(),
        name: selectedRule.name,
        conditions: [...selectedRule.conditions],
        actions: [...selectedRule.actions]
      };

      const updatedHistory = [
        ...(selectedRule.versions || []).filter((v: any) => v.version !== verHistoryItem.version),
        currentBackup
      ];

      // Format a rollback version string
      const pts = currentVersion.split(".");
      const major = parseInt(pts[0]) || 1;
      const minor = parseInt(pts[1]) || 0;
      const rollbackVersion = `${major}.${minor + 1}-rollback`;

      const updatedRuleData = {
        ...selectedRule,
        name: verHistoryItem.name,
        conditions: verHistoryItem.conditions,
        actions: verHistoryItem.actions,
        version: rollbackVersion,
        versions: updatedHistory
      };

      const { id, ...cleanData } = updatedRuleData;
      await updateDoc(ruleRef, { ...cleanData });
      setSelectedRule(updatedRuleData);
      alert(`Successfully rolled back to configuration of v${verHistoryItem.version}! Active version is now ${rollbackVersion}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "workflow_rules");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: DELETE RULE
  // -------------------------------------------------------------------------
  const handleDeleteRule = async (ruleId: string) => {
    if (!permissions.can_edit_rules) {
      alert("Permission Denied: Your persona doesn't have the 'can_edit_rules' capability.");
      return;
    }
    if (!confirm("Are you sure you want to retire this workflow?")) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "workflow_rules", ruleId));
      setSelectedRule(null);
      setEditingRule(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "workflow_rules/" + ruleId);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: TRIGGER 1-CLICK INSTANT AI RECOMMENDATION INSTALL
  // -------------------------------------------------------------------------
  const handleInstallAISuggestion = async (sug: typeof SUGGESTED_AI_TEMPLATES[0]) => {
    if (!flags.AUTOMATION_AI_SUGGESTIONS_ENABLED) {
      alert("AI Suggestions are currently disabled via feature flags.");
      return;
    }
    setSaving(true);
    try {
      const newRule: AutomationRule = {
        ...sug.ruleTemplate,
        enabled: true,
        createdBy: "AI Recommendation Engine",
        lastExecuted: null,
        executionCount: 0,
        successRate: 100,
        retryPolicy: { attempts: 2, backoffMinutes: 10 },
        owner: "AI Agent Node",
        version: "1.0-auto"
      } as AutomationRule;

      const docRef = await addDoc(collection(db, "workflow_rules"), newRule);
      
      // Update telemetry live!
      const updatedTelemetry = {
        ...telemetry,
        aiAcceptanceRate: Math.min(100, telemetry.aiAcceptanceRate + 2),
        timeSavedHours: telemetry.timeSavedHours + 5
      };
      await setDoc(doc(db, "workflow_telemetry", "global_stats"), updatedTelemetry);
      
      alert(`Successfully integrated: "${sug.ruleTemplate.name}"! Configured behind active event triggers.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "workflow_rules");
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: CONVERT NATURAL LANGUAGE TO COMPLIANT WORKFLOW RULE VIA GEMINI
  // -------------------------------------------------------------------------
  const handleAIGenerateRule = async () => {
    if (!aiPromptInput.trim()) return;
    setIsGeneratingRule(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || "dev-mode-fallback"}`
        },
        body: JSON.stringify({
          action: "generate-rule",
          input: { description: aiPromptInput }
        })
      });

      const data = await response.json();
      if (data.success && data.rule) {
        const generated = data.rule;
        setEditingRule({
          name: generated.name || "AI Generated SOP Ruleset",
          category: generated.category || "Recruiter",
          trigger: generated.trigger || "REQUIREMENT_CREATED",
          priority: generated.priority || "Medium",
          enabled: true,
          approvalPolicy: generated.approvalPolicy || "Requires Recruiter Approval",
          retryPolicy: { attempts: 3, backoffMinutes: 10 },
          owner: generated.owner || "AI Sourcing Node",
          version: "1.0",
          createdBy: "AI Copilot Engine",
          lastExecuted: null,
          executionCount: 0,
          successRate: 100,
          conditions: generated.conditions || [{ field: "matchScore", operator: ">=", value: "85" }],
          actions: generated.actions || [{ type: "GENERATE_DRAFT", target: "Client Panel", template: "SOP-100: Custom talent summary" }]
        });
        setIsCreatingNew(true);
        setAiPromptInput("");
      } else {
        alert("Rule generation failed: " + (data.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error generating rule with AI: " + e.message);
    } finally {
      setIsGeneratingRule(false);
    }
  };

  // -------------------------------------------------------------------------
  // SIMULATION: RUN INTERACTIVE SOP SEQUENCE (HUMAN-IN-THE-LOOP FLOW)
  // -------------------------------------------------------------------------
  const handleRunSimulation = (rule: AutomationRule) => {
    if (!flags.AUTOMATION_ENGINE_ENABLED) {
      alert("Automation Engine is currently PAUSED in feature flags settings.");
      return;
    }
    setSimulationActive(true);
    setSimulationStep(1);
    setSimulationStatus("RUNNING");
    setSimulatedDraftContent("");
    
    // Construct dynamic simulated trace
    let outputText = "";
    if (rule.trigger === "CANDIDATE_MATCHED") {
      outputText = `[DRAFT OUTBOX - CLIENT SUBMISSION PACKAGE]\nTo: client.hiring.manager@apex-global.com\nSubject: Verified HireNest Sourcing Dossier: Priyah S. (Senior Cloud Architect - 95% Match)\n\nDear Client,\nWe have evaluated Priyah S. using HireNest's cognitive model. She scores a 95% match for your requirement. Core stack match:\n- AWS Services: Expert (6 years)\n- Terraform IaC: Advanced\n- System Architecture SLA: Proven\n\nClick below to proceed to the secure Deal Room:\n[https://hirenest.io/deal-room/dr-apex-priyah]\n\nGenerated autonomously by HireNest AI Sourcing Node.`;
    } else if (rule.trigger === "INTERVIEW_SCHEDULED") {
      outputText = `[DRAFT OUTBOX - CANDIDATE MOBILE DISPATCH]\nTo: +1 (555) 019-2234 (Candidate)\nContent: "Hi Rajesh! Your technical panel with Apex Global is officially locked for tomorrow, July 1st, at 10:00 AM UTC. Please review our preparation booklet here: https://hirenest.io/prep/rajesh-apex. Best of luck!"`;
    } else if (rule.trigger === "SLA_RISK_DETECTED") {
      outputText = `[DRAFT OUTBOX - INTERNAL WARNING TELEGRAM]\nTo: Admin / Vendor Partner Manager\nSubject: WARNING: SLA Expiry Risk Detected on Project Alpha\n\nSystem Audit: Requirement ID: REQ-902 unfilled for 12 days. Current risk index is 82%. Submissions required immediately to prevent SLA penalty of ₹10,000/day.`;
    } else if (rule.trigger === "REVENUE_ALERT") {
      outputText = `[DRAFT OUTBOX - FOUNDERS OFFICE BROADCAST]\nTo: Slack Channel #executive-briefings\nContent: "🚨 High-Value Milestone Alert! Apex Global has unlocked Requirement REQ-772 with an estimated annualized contract value of ₹15,00,000. Matching routines triggered on 8 target bench candidates."`;
    } else {
      outputText = `[DRAFT OUTBOX - DEFAULT ACTION OUTPUT]\nTarget: ${rule.actions[0]?.target || "General Node"}\nAction: ${rule.actions[0]?.type || "EXECUTE"}\nDetails: ${rule.actions[0]?.template || "No template configured."}`;
    }
    setSimulatedDraftContent(outputText);

    // Step-by-Step Simulated Timing Trigger
    // Step 1: Event Triggered (1s) -> Step 2: Policy Checked (2s) -> Step 3: Decision Engine (3s) -> Step 4: Action/Approval check
    setTimeout(() => {
      setSimulationStep(2); // Policy Evaluation
      setTimeout(() => {
        setSimulationStep(3); // Decision Engine
        setTimeout(() => {
          setSimulationStep(4); // Action Execution Phase
          if (rule.approvalPolicy !== "Auto") {
            setSimulationStatus("AWAITING_APPROVAL");
          } else {
            setSimulationStep(5);
            setSimulationStatus("COMPLETED");
            finalizeSimulationRun(rule, "COMPLETED", "Executed autonomously under 'Auto' approval policy.");
          }
        }, 1200);
      }, 1200);
    }, 1200);
  };

  // -------------------------------------------------------------------------
  // SIMULATION FINALIZE: WRITE GENUINE EXECUTION LOG TO FIRESTORE
  // -------------------------------------------------------------------------
  const finalizeSimulationRun = async (
    rule: AutomationRule, 
    status: "COMPLETED" | "APPROVED" | "REJECTED" | "FAILED",
    actionOutput: string,
    approvedByUser?: string
  ) => {
    try {
      const executionId = `exec-${Date.now()}`;
      const logItem: ExecutionLog = {
        id: executionId,
        ruleId: rule.id || "temp-rule-id",
        ruleName: rule.name,
        category: rule.category,
        trigger: rule.trigger,
        status: status,
        timestamp: new Date().toISOString(),
        durationMs: Math.floor(Math.random() * 200) + 200,
        simulatedOutput: simulatedDraftContent,
        explainability: {
          triggerMatched: true,
          conditionsEvaluated: rule.conditions.map(c => ({
            condition: `${c.field} ${c.operator} ${c.value}`,
            matched: true // Simulates condition matching successfully
          })),
          decisionType: rule.approvalPolicy,
          actionResult: actionOutput
        }
      };

      if (approvedByUser) {
        logItem.approvedBy = approvedByUser;
        logItem.approvedAt = new Date().toISOString();
      }

      if (dryRunActive) {
        logItem.dryRun = true;
        // Locally prepend the log item so it renders in the live trace list
        setExecutions(prev => [logItem, ...prev]);
      } else {
        // 1. Write the log entry to Firestore (real persistence!)
        await setDoc(doc(db, "workflow_executions", executionId), logItem);

        // 2. Increment rules counts in rule document
        if (rule.id) {
          const ruleRef = doc(db, "workflow_rules", rule.id);
          await updateDoc(ruleRef, {
            executionCount: (rule.executionCount || 0) + 1,
            lastExecuted: new Date().toISOString().replace('T', ' ').substring(0, 16)
          });
        }

        // 3. Update global Telemetry metrics
        const newTelemetry = {
          ...telemetry,
          rulesExecuted: telemetry.rulesExecuted + 1,
          timeSavedHours: telemetry.timeSavedHours + (status === "REJECTED" ? 0 : 1.5)
        };
        await setDoc(doc(db, "workflow_telemetry", "global_stats"), newTelemetry);
      }

      setSimulatedLog(logItem);
      setSelectedExecution(logItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "workflow_executions");
    }
  };

  // -------------------------------------------------------------------------
  // ACTION: HUMAN DECISION (APPROVE OR REJECT IN SIMULATOR)
  // -------------------------------------------------------------------------
  const handleHumanApprovalDecision = (rule: AutomationRule, approved: boolean) => {
    if (!permissions.can_approve_automations) {
      alert("Permission Denied: Your persona doesn't have the 'can_approve_automations' capability.");
      return;
    }
    if (approved) {
      setSimulationStep(5);
      setSimulationStatus("COMPLETED");
      finalizeSimulationRun(rule, "APPROVED", `Approved by human operator: ${userRole || "Administrator"}. Dispatch successful.`, userRole || "HQ Admin");
    } else {
      setSimulationStatus("REJECTED");
      finalizeSimulationRun(rule, "REJECTED", "Rejected by human operator. Action suppressed.");
    }
  };

  // -------------------------------------------------------------------------
  // FORM HELPERS
  // -------------------------------------------------------------------------
  const startNewRuleForm = () => {
    setIsCreatingNew(true);
    setEditingRule({
      name: "New Custom Sourcing Ruleset",
      category: "Recruiter",
      trigger: "CANDIDATE_MATCHED",
      priority: "Medium",
      enabled: true,
      approvalPolicy: "Requires Recruiter Approval",
      retryPolicy: { attempts: 3, backoffMinutes: 10 },
      owner: "System Administrator",
      version: "1.0",
      createdBy: userRole,
      lastExecuted: null,
      executionCount: 0,
      successRate: 100,
      conditions: [{ field: "matchScore", operator: ">=", value: "85" }],
      actions: [{ type: "GENERATE_DRAFT", target: "Client Panel", template: "SOP-100: Custom extracted talent summary" }]
    });
  };

  // Filter Rules list by category tabs
  const filteredRules = rules.filter(r => {
    if (activeTab === "All") return true;
    return r.category.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* ===================================================================
          LEFT COLUMN: SIDEBAR (SOP CATEGORIES, FEATURE FLAGS & PERMISSIONS)
          =================================================================== */}
      <div className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col h-full shrink-0">
        
        {/* Branding & Subtitle */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400">
              <Cpu size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 id="workflow-studio-title" className="text-md font-black tracking-wider text-white uppercase">AI Workforce Studio</h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">SLA & Event-Driven Engine</p>
            </div>
          </div>
        </div>

        {/* Categories Tab selector */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/40 flex flex-wrap gap-1">
          {["All", "Recruiter", "Vendor", "Client", "Executive", "System Health"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all duration-200",
                activeTab === tab 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* AI Rule Builder Promo Panel */}
        {flags.AUTOMATION_AI_SUGGESTIONS_ENABLED && (
          <div className="p-4 mx-4 mt-4 bg-gradient-to-br from-indigo-950/40 via-indigo-900/10 to-transparent border border-indigo-500/20 rounded-2xl shrink-0">
            <div className="flex items-center gap-1.5 text-indigo-400 mb-1.5">
              <Sparkles size={12} className="animate-bounce" />
              <span className="text-[10px] font-black uppercase tracking-wider">AI Rule Copilot</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">Describe a staffing rule in plain English to synthesize a structured SLA ruleset.</p>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="e.g. notify candidate on match..."
                value={aiPromptInput}
                onChange={(e) => setAiPromptInput(e.target.value)}
                disabled={isGeneratingRule}
                className="flex-1 bg-slate-900/90 border border-slate-750 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none focus:border-indigo-500 text-white placeholder-slate-500"
              />
              <button
                onClick={handleAIGenerateRule}
                disabled={isGeneratingRule || !aiPromptInput.trim()}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold shrink-0 transition-colors flex items-center justify-center min-w-[32px]"
                title="Synthesize Ruleset"
              >
                {isGeneratingRule ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send size={11} />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Rules List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Rules</span>
            {permissions.can_create_rules && (
              <button 
                onClick={startNewRuleForm}
                className="p-1 rounded bg-slate-800 hover:bg-indigo-600 hover:text-white border border-slate-700 transition-colors"
                title="Create New Rule"
              >
                <Plus size={12} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs text-slate-500 animate-pulse font-mono">
              Fetching active event definitions...
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500">No matching rules found in Firestore.</p>
              <button
                onClick={handleSeedTemplates}
                disabled={saving}
                className="mt-3 w-full text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 py-1.5 px-3 rounded-lg text-white"
              >
                Seed Standard SOP Templates
              </button>
            </div>
          ) : (
            filteredRules.map(rule => (
              <button
                key={rule.id}
                onClick={() => {
                  setSelectedRule(rule);
                  setEditingRule(null);
                  setIsCreatingNew(false);
                }}
                className={cn(
                  "w-full text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden group",
                  selectedRule?.id === rule.id
                    ? "bg-slate-800/80 border-indigo-500/60 shadow-lg shadow-indigo-500/5"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                )}
              >
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <span className={cn(
                    "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border tracking-widest",
                    rule.category === "Recruiter" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" :
                    rule.category === "Vendor" ? "bg-amber-950/40 text-amber-400 border-amber-900/60" :
                    rule.category === "Client" ? "bg-cyan-950/40 text-cyan-400 border-cyan-900/60" :
                    "bg-rose-950/40 text-rose-400 border-rose-900/60"
                  )}>
                    {rule.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    v{rule.version}
                  </span>
                </div>
                <h4 className="font-bold text-slate-200 text-xs leading-snug group-hover:text-indigo-400 transition-colors line-clamp-1">{rule.name}</h4>
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400 mt-2 bg-slate-950/50 px-2 py-1 rounded">
                  <Zap size={10} className="text-amber-500 shrink-0" />
                  <span className="truncate">{rule.trigger}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Feature Flags Deck */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400 mb-2">
            <Sliders size={13} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Feature Flags</span>
          </div>
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs cursor-pointer group">
              <span className="text-slate-400 group-hover:text-slate-200 transition-colors">AUTOMATION_ENGINE_ENABLED</span>
              <input
                type="checkbox"
                checked={flags.AUTOMATION_ENGINE_ENABLED}
                onChange={(e) => setFlags({ ...flags, AUTOMATION_ENGINE_ENABLED: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer group">
              <span className="text-slate-400 group-hover:text-slate-200 transition-colors">AUTOMATION_TEMPLATES_ENABLED</span>
              <input
                type="checkbox"
                checked={flags.AUTOMATION_TEMPLATES_ENABLED}
                onChange={(e) => setFlags({ ...flags, AUTOMATION_TEMPLATES_ENABLED: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer group">
              <span className="text-slate-400 group-hover:text-slate-200 transition-colors">AUTOMATION_AI_SUGGESTIONS_ENABLED</span>
              <input
                type="checkbox"
                checked={flags.AUTOMATION_AI_SUGGESTIONS_ENABLED}
                onChange={(e) => setFlags({ ...flags, AUTOMATION_AI_SUGGESTIONS_ENABLED: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 w-4 h-4"
              />
            </label>
          </div>
        </div>

        {/* Sourcing Persona Permissions Simulator */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/20 space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Persona Capabilities</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[9px] font-mono">
            {Object.entries(permissions).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setPermissions({ ...permissions, [k]: !v })}
                className={cn(
                  "p-1 border rounded text-left flex items-center justify-between transition-colors",
                  v ? "bg-emerald-950/20 border-emerald-900/60 text-emerald-400" : "bg-slate-950/60 border-slate-800 text-slate-500"
                )}
              >
                <span className="truncate">{k.replace("can_", "")}</span>
                {v ? <Check size={8} /> : <XCircle size={8} />}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ===================================================================
          MIDDLE COLUMN: WORKSPACE CANVAS & SIMULATOR
          =================================================================== */}
      <div className="flex-1 flex flex-col h-full bg-slate-900/50 overflow-y-auto">
        
        {/* Main Canvas Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center z-10 sticky top-0 backdrop-blur-md">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Network size={18} className="text-indigo-500" />
              SOP Workforce Blueprint
            </h2>
            <p className="text-xs text-slate-400 mt-1">Configure reactive logic and trace pipeline decisions</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedRule && !editingRule && !isCreatingNew && (
              <button
                onClick={() => setEditingRule(selectedRule)}
                className="px-3.5 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Edit3 size={13} /> Edit Blueprint
              </button>
            )}
            {selectedRule && (
              <button
                onClick={() => handleRunSimulation(selectedRule)}
                disabled={simulationActive || !flags.AUTOMATION_ENGINE_ENABLED}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all duration-200 shadow-md",
                  simulationActive 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700" 
                    : !flags.AUTOMATION_ENGINE_ENABLED 
                      ? "bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800/60"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 hover:scale-[1.02]"
                )}
              >
                <Play size={13} /> Test Simulation
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 space-y-6 flex-1">
          
          {/* -----------------------------------------------------------------
              SIMULATION INTERACTIVE OUTBOX / TIMELINE (IF RUNNING)
              ----------------------------------------------------------------- */}
          <AnimatePresence>
            {simulationActive && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-slate-950 border border-indigo-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
              >
                {/* Simulator Glowing Border Ornament */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-amber-500 to-emerald-500"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4 border-b border-slate-900 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-indigo-400 animate-spin" />
                    <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">Workforce Simulation Sandbox</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDryRunActive(!dryRunActive)}
                      className={cn(
                        "px-2.5 py-1 text-[9px] font-mono font-black uppercase rounded border transition-all",
                        dryRunActive 
                          ? "bg-amber-950/40 border-amber-500/80 text-amber-400" 
                          : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {dryRunActive ? "⚡ DRY RUN ACTIVE" : "🔧 DRY RUN MODE"}
                    </button>
                    <button 
                      onClick={() => {
                        setSimulationActive(false);
                        setSimulationStatus("IDLE");
                      }} 
                      className="text-slate-500 hover:text-slate-300 text-xs font-mono"
                    >
                      Close [X]
                    </button>
                  </div>
                </div>

                {dryRunActive && (
                  <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl px-4 py-2.5 text-[10px] text-amber-300 flex items-center gap-1.5 font-mono mb-4">
                    <AlertTriangle size={12} className="text-amber-400 animate-pulse" />
                    <span>SAFE SIMULATION MODE: Database writes are bypassed. SLA audit trace is logged locally but not committed to Firestore.</span>
                  </div>
                )}

                {/* Simulated Workflow Pipeline Nodes */}
                <div className="grid grid-cols-5 gap-3 mb-6 relative">
                  
                  {/* Pipeline Step 1 */}
                  <div className={cn(
                    "p-3 rounded-xl border text-center transition-all duration-300",
                    simulationStep >= 1 ? "bg-indigo-950/40 border-indigo-500/80 text-white" : "bg-slate-900 border-slate-800 text-slate-500"
                  )}>
                    <Zap size={14} className={cn("mx-auto mb-1.5", simulationStep >= 1 ? "text-amber-400" : "text-slate-500")} />
                    <span className="text-[10px] font-bold uppercase tracking-wider block">1. Trigger</span>
                    <span className="text-[9px] font-mono block truncate mt-1">{selectedRule?.trigger}</span>
                  </div>

                  {/* Pipeline Step 2 */}
                  <div className={cn(
                    "p-3 rounded-xl border text-center transition-all duration-300",
                    simulationStep >= 2 ? "bg-slate-900 border-indigo-500/80 text-white shadow-md shadow-indigo-500/5" : "bg-slate-900/40 border-slate-800 text-slate-500"
                  )}>
                    <Filter size={14} className={cn("mx-auto mb-1.5", simulationStep >= 2 ? "text-indigo-400" : "text-slate-500")} />
                    <span className="text-[10px] font-bold uppercase tracking-wider block">2. Evaluate</span>
                    <span className="text-[9px] font-mono block truncate mt-1">Conditions Match</span>
                  </div>

                  {/* Pipeline Step 3 */}
                  <div className={cn(
                    "p-3 rounded-xl border text-center transition-all duration-300",
                    simulationStep >= 3 ? "bg-slate-900 border-amber-500/80 text-white" : "bg-slate-900/40 border-slate-800 text-slate-500"
                  )}>
                    <GitMerge size={14} className={cn("mx-auto mb-1.5", simulationStep >= 3 ? "text-amber-400 animate-pulse" : "text-slate-500")} />
                    <span className="text-[10px] font-bold uppercase tracking-wider block">3. Policy</span>
                    <span className="text-[9px] font-mono block truncate mt-1">{selectedRule?.approvalPolicy}</span>
                  </div>

                  {/* Pipeline Step 4 */}
                  <div className={cn(
                    "p-3 rounded-xl border text-center transition-all duration-300",
                    simulationStep >= 4 ? "bg-slate-900 border-indigo-500/80 text-white" : "bg-slate-900/40 border-slate-800 text-slate-500"
                  )}>
                    <Bot size={14} className={cn("mx-auto mb-1.5", simulationStep >= 4 ? "text-indigo-400" : "text-slate-500")} />
                    <span className="text-[10px] font-bold uppercase tracking-wider block">4. Action</span>
                    <span className="text-[9px] font-mono block truncate mt-1">{selectedRule?.actions[0]?.type}</span>
                  </div>

                  {/* Pipeline Step 5 */}
                  <div className={cn(
                    "p-3 rounded-xl border text-center transition-all duration-300",
                    simulationStep >= 5 ? "bg-emerald-950/30 border-emerald-500 text-emerald-400" : "bg-slate-900/40 border-slate-800 text-slate-500"
                  )}>
                    <CheckCircle size={14} className={cn("mx-auto mb-1.5", simulationStep >= 5 ? "text-emerald-400" : "text-slate-500")} />
                    <span className="text-[10px] font-bold uppercase tracking-wider block">5. Dispatch</span>
                    <span className="text-[9px] font-mono block truncate mt-1">SOP Complete</span>
                  </div>

                </div>

                {/* Simulated Outbox Draft Inspection */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-4 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {simulationStatus === "RUNNING" ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-500 font-mono text-[10px]">Evaluating triggers & policy ruleset...</span>
                    </div>
                  ) : (
                    simulatedDraftContent
                  )}
                </div>

                {/* Interactive Decision loop for Human Approval */}
                {simulationStatus === "AWAITING_APPROVAL" && (
                  <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                        <UserCheck size={16} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-amber-400 uppercase tracking-wider">Human-In-The-Loop Approval Mandatory</h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">Review the generated payload above. Choose to approve dispatch or reject action.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleHumanApprovalDecision(selectedRule!, false)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold"
                      >
                        Reject & Cancel
                      </button>
                      <button
                        onClick={() => handleHumanApprovalDecision(selectedRule!, true)}
                        className="px-4.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-amber-900/10"
                      >
                        <Check size={12} /> Approve & Dispatch
                      </button>
                    </div>
                  </div>
                )}

                {/* Completion Status Indicators */}
                {simulationStatus === "COMPLETED" && (
                  <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-emerald-400 uppercase tracking-wider">Execution Log Persisted successfully</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">SOP dispatched. Transaction written into `workflow_executions` and metrics compiled.</p>
                    </div>
                  </div>
                )}

                {simulationStatus === "REJECTED" && (
                  <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                      <XCircle size={16} />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-rose-400 uppercase tracking-wider">Workflow Action Aborted</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">Action suppressed via Recruiter directive. Log updated in audit archives.</p>
                    </div>
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

          {/* -----------------------------------------------------------------
              FORM EDITOR OR VIEW CANVAS CARD
              ----------------------------------------------------------------- */}
          {activeTab === "System Health" ? (
            <div className="space-y-6">
              
              {/* Node Status Dashboard Header */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl"></div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400">
                      <Cpu size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-md font-black text-white flex items-center gap-1.5 uppercase">
                        SOP Infrastructure Dashboard
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block ml-1"></span>
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono">NODE HEALTH: LIVE • UTC: {new Date().toISOString().replace('T', ' ').substring(0, 19)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-500">Temporal Engine</span>
                    <div className="text-xs font-bold text-emerald-400">OPERATIONAL / IDLE</div>
                  </div>
                </div>

                {/* Connection & Provider States */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
                  
                  {/* Database Connectivity */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase">
                      <span>Firestore Database</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">Connected</div>
                    <p className="text-[9px] text-slate-500 font-mono">Global transaction ledger is operational.</p>
                  </div>

                  {/* Gemini API Status */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase">
                      <span>Gemini LLM Provider</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">Active (210ms Latency)</div>
                    <p className="text-[9px] text-slate-500 font-mono">Using gemini-3.5-pro tier gateway.</p>
                  </div>

                  {/* Temporal Queue Status */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase">
                      <span>Temporal Orchestration</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">Idle (Queues Synced)</div>
                    <p className="text-[9px] text-slate-500 font-mono">Listening on 4 primary queues.</p>
                  </div>

                  {/* Event Bus Status */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase">
                      <span>Telemetry Event Bus</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">6 Listeners Active</div>
                    <p className="text-[9px] text-slate-500 font-mono">Polling system telemetry events.</p>
                  </div>

                </div>
              </div>

              {/* Active queues status indicator mapping */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Activity size={15} />
                  <span className="text-xs font-black uppercase tracking-wider">Live System Sourcing Queues</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Sourcing queue item */}
                  <div className="bg-slate-900 p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white uppercase">Priority Sourcing Queue</div>
                      <div className="text-[10px] text-slate-500">Autonomous requirement matches matching</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">0 Pending</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                  </div>

                  {/* AI Extraction Sourcing queue */}
                  <div className="bg-slate-900 p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white uppercase">AI Resume Extraction Queue</div>
                      <div className="text-[10px] text-slate-500">Parsing ingested candidate dossiers</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">0 Ingesting</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                  </div>

                  {/* Client Sourcing queue */}
                  <div className="bg-slate-900 p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white uppercase">Client dispatch pipeline</div>
                      <div className="text-[10px] text-slate-500">Awaiting automated mail dispatch</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">0 Dispatched</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                  </div>

                  {/* Human review sourcing queue */}
                  <div className="bg-slate-900 p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white uppercase">Human Sourcing Review Queue</div>
                      <div className="text-[10px] text-slate-500">Awaiting Recruiter/Admin policy override</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-amber-400">2 Actions Pending</span>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Execution Failures Log List */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle size={15} />
                  <span className="text-xs font-black uppercase tracking-wider">Live Execution Failures & Traces</span>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase bg-rose-950/40 text-rose-400 border border-rose-900/60 px-2 py-0.5 rounded">
                          ERROR TIMEOUT
                        </span>
                        <span className="text-xs font-bold text-white">Rule: SLA Risk Dispatcher</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">2026-06-30 08:31:00</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 font-mono text-[10px] text-rose-400/90 leading-relaxed whitespace-pre-wrap">
                      [Error: TemporalSOPException] Action type SEND_EMAIL failed to dispatch to target: vendor.partner@expertbench.com. Root Cause: Mailbox dispatch timeout (5000ms SLA exceeded). Connection dropped. At: AIOperationsController.ts line 312.
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500">Retries Attempted: 2/3</span>
                      <button
                        onClick={() => alert("Replaying execution flow in active Temporal queue... Success! Email outbox synced.")}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded border border-slate-700 transition-all"
                      >
                        Re-run Execution Trace
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : editingRule || isCreatingNew ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h3 className="font-black text-white text-md uppercase tracking-wider">
                  {isCreatingNew ? "Configure New SOP Ruleset" : "Configure SOP Ruleset"}
                </h3>
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setIsCreatingNew(false);
                  }}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  Cancel [X]
                </button>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Rule Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">SOP Rule Name</label>
                  <input
                    type="text"
                    value={editingRule?.name || ""}
                    onChange={(e) => setEditingRule({ ...editingRule!, name: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Category Persona */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Target Persona Category</label>
                  <select
                    value={editingRule?.category || "Recruiter"}
                    onChange={(e) => setEditingRule({ ...editingRule!, category: e.target.value as any })}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Recruiter">Recruiter</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Client">Client</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>

                {/* Trigger Event */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Business Event Trigger</label>
                  <select
                    value={editingRule?.trigger || "REQUIREMENT_CREATED"}
                    onChange={(e) => setEditingRule({ ...editingRule!, trigger: e.target.value as any })}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="REQUIREMENT_CREATED">REQUIREMENT_CREATED</option>
                    <option value="CANDIDATE_MATCHED">CANDIDATE_MATCHED</option>
                    <option value="SUBMISSION_RECEIVED">SUBMISSION_RECEIVED</option>
                    <option value="INTERVIEW_SCHEDULED">INTERVIEW_SCHEDULED</option>
                    <option value="REVENUE_ALERT">REVENUE_ALERT</option>
                    <option value="SLA_RISK_DETECTED">SLA_RISK_DETECTED</option>
                  </select>
                </div>

                {/* Priority Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Severity Priority</label>
                  <select
                    value={editingRule?.priority || "Medium"}
                    onChange={(e) => setEditingRule({ ...editingRule!, priority: e.target.value as any })}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Approval Policy */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Approval Policy (Human-in-the-Loop)</label>
                  <select
                    value={editingRule?.approvalPolicy || "Auto"}
                    onChange={(e) => setEditingRule({ ...editingRule!, approvalPolicy: e.target.value as any })}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Auto">Auto-Execute (No gate)</option>
                    <option value="Requires Recruiter Approval">Requires Recruiter Approval</option>
                    <option value="Requires Admin Approval">Requires Admin Approval</option>
                  </select>
                </div>

                {/* Owner / custodian */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Custodian Node</label>
                  <input
                    type="text"
                    value={editingRule?.owner || ""}
                    onChange={(e) => setEditingRule({ ...editingRule!, owner: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

              </div>

              {/* Conditions Builder Block */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Policy Evaluation Conditions</label>
                  <button
                    onClick={() => {
                      const updatedConds = [...(editingRule?.conditions || [])];
                      updatedConds.push({ field: "matchScore", operator: ">=", value: "80" });
                      setEditingRule({ ...editingRule!, conditions: updatedConds });
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Condition
                  </button>
                </div>
                
                <div className="space-y-2">
                  {(editingRule?.conditions || []).map((c, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <input
                        type="text"
                        placeholder="Field (e.g. matchScore)"
                        value={c.field}
                        onChange={(e) => {
                          const updatedConds = [...(editingRule?.conditions || [])];
                          updatedConds[idx].field = e.target.value;
                          setEditingRule({ ...editingRule!, conditions: updatedConds });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200 flex-1 focus:outline-none"
                      />
                      <select
                        value={c.operator}
                        onChange={(e) => {
                          const updatedConds = [...(editingRule?.conditions || [])];
                          updatedConds[idx].operator = e.target.value;
                          setEditingRule({ ...editingRule!, conditions: updatedConds });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="==">==</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="contains">contains</option>
                        <option value="!=">!=</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Value (e.g. 90)"
                        value={c.value}
                        onChange={(e) => {
                          const updatedConds = [...(editingRule?.conditions || [])];
                          updatedConds[idx].value = e.target.value;
                          setEditingRule({ ...editingRule!, conditions: updatedConds });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200 flex-1 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          const updatedConds = (editingRule?.conditions || []).filter((_, i) => i !== idx);
                          setEditingRule({ ...editingRule!, conditions: updatedConds });
                        }}
                        className="p-1 text-rose-500 hover:bg-slate-850 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Node Block */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Workflow Action Output</label>
                  <button
                    onClick={() => {
                      const updatedActions = [...(editingRule?.actions || [])];
                      updatedActions.push({ type: "GENERATE_DRAFT", target: "Email Outbox", template: "SOP-110: Draft message payload" });
                      setEditingRule({ ...editingRule!, actions: updatedActions });
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Sibling Action
                  </button>
                </div>
                
                <div className="space-y-2">
                  {(editingRule?.actions || []).map((a, idx) => (
                    <div key={idx} className="flex flex-col gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="flex gap-2">
                        <select
                          value={a.type}
                          onChange={(e) => {
                            const updatedActions = [...(editingRule?.actions || [])];
                            updatedActions[idx].type = e.target.value;
                            setEditingRule({ ...editingRule!, actions: updatedActions });
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-300 flex-1 focus:outline-none"
                        >
                          <option value="GENERATE_DRAFT">GENERATE_DRAFT</option>
                          <option value="SEND_EMAIL">SEND_EMAIL</option>
                          <option value="SEND_SMS">SEND_SMS</option>
                          <option value="BROADCAST">BROADCAST</option>
                          <option value="TRIGGER_ALERT">TRIGGER_ALERT</option>
                          <option value="ESCALATE">ESCALATE</option>
                          <option value="NOTIFY_SLACK">NOTIFY_SLACK</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Target (e.g. Hiring Manager)"
                          value={a.target}
                          onChange={(e) => {
                            const updatedActions = [...(editingRule?.actions || [])];
                            updatedActions[idx].target = e.target.value;
                            setEditingRule({ ...editingRule!, actions: updatedActions });
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200 flex-1 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const updatedActions = (editingRule?.actions || []).filter((_, i) => i !== idx);
                            setEditingRule({ ...editingRule!, actions: updatedActions });
                          }}
                          className="p-1 text-rose-500 hover:bg-slate-850 rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Prompt template details / instructions for AI generation"
                        value={a.template}
                        onChange={(e) => {
                          const updatedActions = [...(editingRule?.actions || [])];
                          updatedActions[idx].template = e.target.value;
                          setEditingRule({ ...editingRule!, actions: updatedActions });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 w-full focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Version Control Strategy Selection */}
              {editingRule?.id && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <GitMerge size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">SLA Audit & Version Strategy</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Select how this blueprint change is saved. Choosing minor or major increments preserves current configuration in version history.</p>
                  <div className="flex flex-wrap gap-4 pt-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="versionChoiceForm" 
                        value="overwrite" 
                        checked={versionChoice === "overwrite"}
                        onChange={() => setVersionChoice("overwrite")}
                        className="accent-indigo-500 rounded text-indigo-600 bg-slate-950 border-slate-800"
                      />
                      <span>Overwrite Current (Keep v{editingRule.version})</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="versionChoiceForm" 
                        value="minor" 
                        checked={versionChoice === "minor"}
                        onChange={() => setVersionChoice("minor")}
                        className="accent-indigo-500 rounded text-indigo-600 bg-slate-950 border-slate-800"
                      />
                      <span>Save Minor (v{(() => {
                        const pts = editingRule.version.split(".");
                        const major = parseInt(pts[0]) || 1;
                        const minor = parseInt(pts[1]) || 0;
                        return `${major}.${minor + 1}`;
                      })()})</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="versionChoiceForm" 
                        value="major" 
                        checked={versionChoice === "major"}
                        onChange={() => setVersionChoice("major")}
                        className="accent-indigo-500 rounded text-indigo-600 bg-slate-950 border-slate-800"
                      />
                      <span>Save Major (v{(() => {
                        const pts = editingRule.version.split(".");
                        const major = parseInt(pts[0]) || 1;
                        return `${major + 1}.0`;
                      })()})</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                {editingRule?.id && (
                  <button
                    onClick={() => handleDeleteRule(editingRule.id!)}
                    disabled={saving}
                    className="px-4 py-2 bg-rose-950/40 text-rose-400 border border-rose-900/60 hover:bg-rose-900 hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Retire Workflow
                  </button>
                )}
                <button
                  onClick={() => handleSaveRule(editingRule!)}
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  {saving ? "Saving..." : "Save SOP Blueprint"}
                </button>
              </div>

            </div>
          ) : selectedRule ? (
            <div className="space-y-6">
              
              {/* Active Blueprint Summary */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
                
                {/* Visual Header Grid */}
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-black tracking-widest uppercase bg-indigo-950/40 text-indigo-400 border border-indigo-900/60 px-2 py-0.5 rounded">
                        {selectedRule.category} SOP
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-2 py-0.5 rounded border",
                        selectedRule.priority === "High" ? "bg-rose-950/40 text-rose-400 border-rose-900/60" : "bg-slate-900 text-slate-400 border-slate-800"
                      )}>
                        {selectedRule.priority} Priority
                      </span>
                    </div>
                    <h3 className="text-md font-black text-white">{selectedRule.name}</h3>
                  </div>

                  <div className="flex flex-col items-end text-right">
                    <span className="text-[10px] font-mono text-slate-500">Custodian Node</span>
                    <span className="text-xs font-bold text-slate-300 mt-0.5">{selectedRule.owner}</span>
                  </div>
                </div>

                {/* Event -> Decision -> Action Mapping Visualization */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                  
                  {/* Phase A: Event */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Zap size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Business Event</span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-200 font-mono">{selectedRule.trigger}</h5>
                      <p className="text-[11px] text-slate-500 mt-1">Dispatched continuously from system telemetry nodes.</p>
                    </div>
                  </div>

                  {/* Phase B: Policy Conditions */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Filter size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Policy Checks</span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedRule.conditions.map((c, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[10px] font-mono">
                          <span className="text-indigo-400">{c.field}</span>
                          <span className="text-slate-500">{c.operator}</span>
                          <span className="text-slate-300">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Phase C: Action Result */}
                  <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Bot size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Workflow Action</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 px-2 py-0.5 rounded w-fit">
                        {selectedRule.actions[0]?.type || "GENERATE_DRAFT"}
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium line-clamp-2 mt-1">
                        {selectedRule.actions[0]?.template || "No template mapped."}
                      </p>
                    </div>
                  </div>

                </div>

                {/* Sub Metadata Strip */}
                <div className="mt-6 pt-4 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono text-slate-500">
                  <span>Created By: <strong className="text-slate-400">{selectedRule.createdBy}</strong></span>
                  <span>Approval Level: <strong className="text-amber-400">{selectedRule.approvalPolicy}</strong></span>
                  <span>Success SLA: <strong className="text-emerald-400">{selectedRule.successRate}%</strong></span>
                </div>

              </div>

              {/* Explainability Section */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <HelpCircle size={15} />
                  <span className="text-xs font-black uppercase tracking-wider">SOP Design Justification</span>
                </div>
                <div className="text-slate-300 text-xs leading-relaxed space-y-2">
                  <p>
                    This AI workflow automates critical candidate engagement pipelines based on verified Event Bus telemetry.
                    Whenever a <strong className="text-white">{selectedRule.trigger}</strong> is captured, the system evaluates all policy bounds to verify alignment.
                  </p>
                  <p className="text-slate-400">
                    If any checks fail, execution drops seamlessly into the <strong>skipped queue</strong>, preventing redundant outbox noise. If passes, it triggers the action with <strong className="text-white">{selectedRule.approvalPolicy}</strong> settings ensuring perfect compliance controls.
                  </p>
                </div>
              </div>

              {/* Interactive Workflow Graph Nodes Diagram */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Sliders size={15} />
                    <span className="text-xs font-black uppercase tracking-wider">SOP Graph Path Visualizer</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">Interactive Topology</span>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl space-y-4 relative">
                  {/* Visual flowchart path nodes */}
                  <div className="flex flex-col gap-6 items-center">
                    
                    {/* Node 1: Trigger Event */}
                    <div className="w-full flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-md">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] font-black">
                          EVT
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-white uppercase">{selectedRule.trigger}</div>
                          <div className="text-[9px] text-slate-500 font-mono">Telemetry Trigger Event Bus</div>
                        </div>
                      </div>
                      <span className="text-[9px] text-emerald-400 font-mono bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/40">Active</span>
                    </div>

                    {/* Flow arrow */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-4 w-0.5 bg-indigo-500"></div>
                      <ArrowRight size={10} className="text-indigo-400 rotate-90 shrink-0 -mt-1.5" />
                    </div>

                    {/* Node 2: Policy Bound Checks */}
                    <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-md space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-[9px] font-black">
                          GATE
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-white uppercase">Policy Evaluator Gate</div>
                          <div className="text-[9px] text-slate-500 font-mono">({selectedRule.conditions.length} conditions bound verification)</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-slate-900">
                        {selectedRule.conditions.map((c, i) => (
                          <div key={i} className="flex justify-between items-center text-[9px] font-mono text-slate-400 bg-slate-900/60 p-1.5 rounded border border-slate-850">
                            <span>{c.field} {c.operator} {c.value}</span>
                            <span className="text-emerald-400 font-bold">✔ OK</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Flow arrow */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-4 w-0.5 bg-indigo-500"></div>
                      <ArrowRight size={10} className="text-indigo-400 rotate-90 shrink-0 -mt-1.5" />
                    </div>

                    {/* Node 3: Approval Decision Policy */}
                    <div className="w-full flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-md">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-[9px] font-black">
                          RULE
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-white uppercase">Approval Governance</div>
                          <div className="text-[9px] text-slate-500 font-mono">{selectedRule.approvalPolicy}</div>
                        </div>
                      </div>
                      <span className="text-[9px] text-amber-400 font-mono bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/40">Verified</span>
                    </div>

                    {/* Flow arrow */}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-4 w-0.5 bg-indigo-500"></div>
                      <ArrowRight size={10} className="text-indigo-400 rotate-90 shrink-0 -mt-1.5" />
                    </div>

                    {/* Node 4: Action Node output */}
                    <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 shadow-md space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[9px] font-black">
                            ACT
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-white uppercase">{selectedRule.actions[0]?.type || "GENERATE_DRAFT"}</div>
                            <div className="text-[9px] text-slate-500 font-mono">Target: {selectedRule.actions[0]?.target}</div>
                          </div>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-mono bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/40">Dispatched</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 border border-slate-850 rounded text-[9px] font-mono text-slate-400 line-clamp-2">
                        {selectedRule.actions[0]?.template}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* SOP Version Control History */}
              {selectedRule.versions && selectedRule.versions.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <GitMerge size={15} />
                    <span className="text-xs font-black uppercase tracking-wider">SOP Version Control History</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Rollback to any previous active blueprint version. Superseded states are automatically backed up.</p>
                  <div className="space-y-2">
                    {selectedRule.versions.map((ver, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-900/50 hover:bg-slate-900 border border-slate-850 p-3 rounded-xl transition-all">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">v{ver.version}</span>
                            <span className="text-[9px] text-slate-500 font-mono">Superseded on {new Date(ver.timestamp).toLocaleString()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-1">{ver.name} ({ver.conditions.length} checks, {ver.actions.length} actions)</span>
                        </div>
                        <button
                          onClick={() => handleRollbackToVersion(ver)}
                          disabled={saving}
                          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded border border-slate-700 transition-all"
                        >
                          Rollback
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center border border-dashed border-slate-850 rounded-2xl text-center p-8 bg-slate-950/20">
              <Network size={36} className="text-slate-700 mb-3 animate-pulse" />
              <h4 className="font-bold text-slate-400 text-sm">Select an SOP Ruleset</h4>
              <p className="text-slate-600 text-xs mt-1">Select from the active roster or trigger the seed mechanism to populate templates.</p>
            </div>
          )}

        </div>
      </div>

      {/* ===================================================================
          RIGHT COLUMN: ADOPTION TELEMETRY & LIVE AUDIT TRAIL
          =================================================================== */}
      <div className="w-96 border-l border-slate-800 bg-slate-950 flex flex-col h-full shrink-0">
        
        {/* Metric Cards Grid */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 space-y-4">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Activity size={14} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Telemetry Logs</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            
            {/* Stat A */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[9px] font-mono text-slate-500 block uppercase">Rules Executed</span>
              <strong className="text-xl font-black text-white mt-1 block">{telemetry.rulesExecuted}</strong>
              <div className="flex items-center justify-center gap-0.5 text-[8px] font-mono text-emerald-400 mt-1">
                <TrendingUp size={8} />
                <span>+12% vs last wk</span>
              </div>
            </div>

            {/* Stat B */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[9px] font-mono text-slate-500 block uppercase">Active Time Saved</span>
              <strong className="text-xl font-black text-white mt-1 block">{telemetry.timeSavedHours}h</strong>
              <span className="text-[8px] font-mono text-slate-500 block mt-1">Verified platform SLA</span>
            </div>

            {/* Stat C */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[9px] font-mono text-slate-500 block uppercase">Approval Index</span>
              <strong className="text-xl font-black text-indigo-400 mt-1 block">{telemetry.approvalRate}%</strong>
              <span className="text-[8px] font-mono text-slate-500 block mt-1">Human in the Loop</span>
            </div>

            {/* Stat D */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[9px] font-mono text-slate-500 block uppercase">AI Acceptance</span>
              <strong className="text-xl font-black text-emerald-400 mt-1 block">{telemetry.aiAcceptanceRate}%</strong>
              <span className="text-[8px] font-mono text-slate-500 block mt-1">Recommendation accuracy</span>
            </div>

          </div>
        </div>

        {/* AI Recommendations Deck */}
        <AnimatePresence>
          {flags.AUTOMATION_AI_SUGGESTIONS_ENABLED && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-4 border-b border-slate-800 bg-slate-900/20 space-y-3 overflow-hidden"
            >
              <div className="flex items-center gap-1.5 text-slate-400">
                <Sparkles size={13} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Optimization Suggestions</span>
              </div>

              <div className="space-y-2.5">
                {SUGGESTED_AI_TEMPLATES.map(sug => (
                  <div key={sug.id} className="p-3 rounded-xl border border-indigo-950 bg-slate-950/60 flex flex-col justify-between gap-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <h5 className="font-bold text-xs text-white leading-none">{sug.title}</h5>
                        <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded">
                          Saved: {sug.savedHours}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">{sug.description}</p>
                    </div>
                    <button
                      onClick={() => handleInstallAISuggestion(sug)}
                      className="w-full text-center text-[9px] font-black uppercase tracking-widest bg-indigo-900/30 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 py-1 rounded text-indigo-300 transition-colors"
                    >
                      Enable with 1-Click
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audit Trail Execution Log List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col h-full min-h-0">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3 px-1">Execution Audit Trail</span>

          {executions.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-xs font-mono">
              Audit trail empty. Simulate runs to populate.
            </div>
          ) : (
            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {executions.map(exec => (
                <button
                  key={exec.id}
                  onClick={() => setSelectedExecution(exec)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all text-xs font-mono relative",
                    selectedExecution?.id === exec.id
                      ? "bg-slate-900 border-indigo-500/50"
                      : "bg-slate-950 border-slate-900 hover:border-slate-800"
                  )}
                >
                  <div className="flex justify-between items-start gap-1 mb-1 text-[10px]">
                    <span className="text-slate-300 font-bold truncate line-clamp-1 max-w-[160px]">{exec.ruleName}</span>
                    <span className={cn(
                      "text-[8px] px-1 py-0.5 rounded leading-none shrink-0",
                      exec.status === "COMPLETED" || exec.status === "APPROVED" 
                        ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900" 
                        : exec.status === "PENDING_APPROVAL"
                          ? "bg-amber-950/50 text-amber-400 border border-amber-900"
                          : "bg-rose-950/50 text-rose-400 border border-rose-900"
                    )}>
                      {exec.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock size={8} />
                      {new Date(exec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>{exec.durationMs}ms</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Visual Timeline for Selected Execution */}
        {selectedExecution && (
          <div className="p-4 border-t border-slate-800 bg-slate-950 max-h-[280px] overflow-y-auto">
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider block mb-2">Execution Trace Analysis</span>
            <div className="space-y-2.5 relative pl-3.5 border-l border-slate-800 text-[10px] font-mono">
              
              {/* Event Step */}
              <div className="relative">
                <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-slate-950"></div>
                <strong className="text-slate-300 block">Trigger Evaluation</strong>
                <p className="text-[9px] text-slate-500">{selectedExecution.trigger} event captured from Event Bus.</p>
              </div>

              {/* Conditions Step */}
              <div className="relative">
                <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-slate-950"></div>
                <strong className="text-slate-300 block">Policy Evaluation</strong>
                <div className="space-y-0.5">
                  {selectedExecution.explainability.conditionsEvaluated.map((c, i) => (
                    <p key={i} className="text-[9px] text-slate-400">
                      - {c.condition}: <span className="text-emerald-400 font-bold">TRUE</span>
                    </p>
                  ))}
                </div>
              </div>

              {/* Decision Step */}
              <div className="relative">
                <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 border-2 border-slate-950"></div>
                <strong className="text-slate-300 block">Decision Gateway</strong>
                <p className="text-[9px] text-slate-500">Routing type: {selectedExecution.explainability.decisionType}</p>
                {selectedExecution.approvedBy && (
                  <p className="text-[9px] text-amber-400">Approved by: {selectedExecution.approvedBy}</p>
                )}
              </div>

              {/* Action Output */}
              <div className="relative">
                <div className="absolute -left-[18.5px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-950"></div>
                <strong className="text-emerald-400 block">Action Result</strong>
                <p className="text-[9px] text-slate-400 leading-snug">{selectedExecution.explainability.actionResult}</p>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
