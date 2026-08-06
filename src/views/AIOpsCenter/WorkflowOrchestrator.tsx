// src/views/AIOpsCenter/WorkflowOrchestrator.tsx
import React, { useState, useEffect, useMemo } from "react";
import { 
  Workflow, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Bot, 
  User, 
  Sparkles, 
  TrendingUp, 
  PlusCircle, 
  RotateCcw, 
  FileText, 
  Layers, 
  Settings, 
  Play, 
  ArrowRight,
  ShieldAlert,
  Calendar,
  X,
  Check
} from "lucide-react";
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { WorkflowInstance, WorkflowState, WorkflowType, RequirementState, SubmissionState, OnboardingState, WorkflowEvent } from "../../types/workflow";

// Define Enterprise Workflow Templates
export interface WorkflowTemplate {
  id: string;
  name: string;
  type: WorkflowType;
  description: string;
  stages: WorkflowState[];
  defaultSLAHours: Record<string, number>;
  defaultAIAgent: string;
  defaultHumanRole: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "temp-perm",
    name: "Permanent Hiring",
    type: "req_lifecycle",
    description: "Standard lifecycle for executive, full-time talent acquisitions.",
    stages: [
      RequirementState.DRAFT,
      RequirementState.PENDING_APPROVAL,
      RequirementState.ACTIVE,
      RequirementState.SOURCING,
      RequirementState.INTERVIEWING,
      RequirementState.OFFER_PENDING,
      RequirementState.ONBOARDING,
      RequirementState.FULFILLED
    ],
    defaultSLAHours: {
      [RequirementState.DRAFT]: 24,
      [RequirementState.PENDING_APPROVAL]: 12,
      [RequirementState.ACTIVE]: 48,
      [RequirementState.SOURCING]: 72,
      [RequirementState.INTERVIEWING]: 120,
      [RequirementState.OFFER_PENDING]: 48,
      [RequirementState.ONBOARDING]: 168
    },
    defaultAIAgent: "recruitment-office",
    defaultHumanRole: "Bruce Wayne (Talent Director)"
  },
  {
    id: "temp-contract",
    name: "Contract Staffing",
    type: "req_lifecycle",
    description: "Accelerated, high-velocity contractor bench placement.",
    stages: [
      RequirementState.DRAFT,
      RequirementState.ACTIVE,
      RequirementState.SOURCING,
      RequirementState.SUBMISSION_IN_PROGRESS,
      RequirementState.INTERVIEWING,
      RequirementState.FULFILLED,
      RequirementState.CLOSED
    ],
    defaultSLAHours: {
      [RequirementState.DRAFT]: 12,
      [RequirementState.ACTIVE]: 24,
      [RequirementState.SOURCING]: 24,
      [RequirementState.SUBMISSION_IN_PROGRESS]: 12,
      [RequirementState.INTERVIEWING]: 48,
      [RequirementState.FULFILLED]: 24
    },
    defaultAIAgent: "marketplace-office",
    defaultHumanRole: "Steve Rogers (Ops Coordinator)"
  },
  {
    id: "temp-vendor",
    name: "Vendor Submission",
    type: "submission_lifecycle",
    description: "Ecosystem partner-sourced match and validation checks.",
    stages: [
      SubmissionState.CREATED,
      SubmissionState.SUBMITTED,
      SubmissionState.UNDER_REVIEW,
      SubmissionState.SHORTLISTED,
      SubmissionState.INTERVIEW_IN_PROGRESS,
      SubmissionState.PLACED,
      SubmissionState.INVOICE_GENERATED
    ],
    defaultSLAHours: {
      [SubmissionState.CREATED]: 6,
      [SubmissionState.SUBMITTED]: 12,
      [SubmissionState.UNDER_REVIEW]: 24,
      [SubmissionState.SHORTLISTED]: 48,
      [SubmissionState.INTERVIEW_IN_PROGRESS]: 72,
      [SubmissionState.PLACED]: 48
    },
    defaultAIAgent: "vendor-office",
    defaultHumanRole: "Clark Kent (Partner Mgr)"
  },
  {
    id: "temp-internal",
    name: "Internal Mobility",
    type: "req_lifecycle",
    description: "Employee matching and lateral organizational transfers.",
    stages: [
      RequirementState.DRAFT,
      RequirementState.ACTIVE,
      RequirementState.SOURCING,
      RequirementState.INTERVIEWING,
      RequirementState.ONBOARDING,
      RequirementState.FULFILLED
    ],
    defaultSLAHours: {
      [RequirementState.DRAFT]: 24,
      [RequirementState.ACTIVE]: 48,
      [RequirementState.SOURCING]: 48,
      [RequirementState.INTERVIEWING]: 72,
      [RequirementState.ONBOARDING]: 120
    },
    defaultAIAgent: "founder-office",
    defaultHumanRole: "Diana Prince (VP Ops)"
  }
];

// Fallback workflow instances for robust visual display
const FALLBACK_WORKFLOWS: WorkflowInstance[] = [
  {
    workflowId: "wf_perm_kubernetes",
    workflowType: "req_lifecycle",
    entityId: "req-091",
    currentState: RequirementState.SOURCING,
    ownerOrgId: "org-hn-master",
    responsibleUsers: ["Bruce Wayne"],
    visibilityScopes: ["global"],
    participantOrganizations: ["org-hn-master", "vendor-apex"],
    createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    slaTimers: [
      {
        timerId: "sla_sourcing_kubernetes",
        state: RequirementState.SOURCING,
        startedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
        deadlineAt: new Date(Date.now() + 60 * 3600000).toISOString(),
        status: "active"
      }
    ],
    riskFlags: [
      {
        flagId: "risk_kubernetes_market",
        type: "SLA_BREACH_RISK",
        severity: "LOW",
        message: "High demand for Go-proficient Kubernetes architects may prolong sourcing.",
        identifiedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
        resolved: false
      }
    ],
    history: [
      {
        eventId: "evt_init",
        workflowId: "wf_perm_kubernetes",
        workflowType: "req_lifecycle",
        eventType: "INITIALIZE_WORKFLOW",
        fromState: RequirementState.DRAFT,
        toState: RequirementState.DRAFT,
        actorId: "usr_diana",
        organizationId: "org-hn-master",
        timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
        metadata: { notes: "Kubernetes Architect Permanent workflow initiated." }
      },
      {
        eventId: "evt_to_approved",
        workflowId: "wf_perm_kubernetes",
        workflowType: "req_lifecycle",
        eventType: "STATE_TRANSITION",
        fromState: RequirementState.DRAFT,
        toState: RequirementState.PENDING_APPROVAL,
        actorId: "usr_diana",
        organizationId: "org-hn-master",
        timestamp: new Date(Date.now() - 34 * 3600000).toISOString(),
        metadata: { notes: "Submitted for VP of HR approval." }
      },
      {
        eventId: "evt_to_active",
        workflowId: "wf_perm_kubernetes",
        workflowType: "req_lifecycle",
        eventType: "STATE_TRANSITION",
        fromState: RequirementState.PENDING_APPROVAL,
        toState: RequirementState.ACTIVE,
        actorId: "usr_bruce",
        organizationId: "org-hn-master",
        timestamp: new Date(Date.now() - 30 * 3600000).toISOString(),
        metadata: { notes: "Sourcing campaign activated." }
      },
      {
        eventId: "evt_to_sourcing",
        workflowId: "wf_perm_kubernetes",
        workflowType: "req_lifecycle",
        eventType: "STATE_TRANSITION",
        fromState: RequirementState.ACTIVE,
        toState: RequirementState.SOURCING,
        actorId: "usr_conrad_ai",
        organizationId: "org-hn-master",
        timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
        metadata: { notes: "Conrad Conductor AI attached to candidate match index." }
      }
    ]
  },
  {
    workflowId: "wf_contract_godev",
    workflowType: "req_lifecycle",
    entityId: "req-092",
    currentState: RequirementState.SOURCING,
    ownerOrgId: "org-hn-master",
    responsibleUsers: ["Clark Kent"],
    visibilityScopes: ["global"],
    participantOrganizations: ["org-hn-master"],
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    slaTimers: [
      {
        timerId: "sla_sourcing_godev",
        state: RequirementState.SOURCING,
        startedAt: new Date(Date.now() - 44 * 3600000).toISOString(),
        deadlineAt: new Date(Date.now() - 20 * 3600000).toISOString(), // Past deadline
        status: "breached"
      }
    ],
    riskFlags: [
      {
        flagId: "risk_godev_latency",
        type: "SLA_BREACH_RISK",
        severity: "CRITICAL",
        message: "Sourcing stage exceeded contract SLA of 24 hours.",
        identifiedAt: new Date(Date.now() - 20 * 3600000).toISOString(),
        resolved: false
      }
    ],
    history: [
      {
        eventId: "evt_init_godev",
        workflowId: "wf_contract_godev",
        workflowType: "req_lifecycle",
        eventType: "INITIALIZE_WORKFLOW",
        fromState: RequirementState.DRAFT,
        toState: RequirementState.DRAFT,
        actorId: "usr_tony",
        organizationId: "org-hn-master",
        timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
        metadata: { notes: "Go Developer workflow initiated." }
      },
      {
        eventId: "evt_to_active_godev",
        workflowId: "wf_contract_godev",
        workflowType: "req_lifecycle",
        eventType: "STATE_TRANSITION",
        fromState: RequirementState.DRAFT,
        toState: RequirementState.ACTIVE,
        actorId: "usr_bruce",
        organizationId: "org-hn-master",
        timestamp: new Date(Date.now() - 46 * 3600000).toISOString(),
        metadata: { notes: "Contract terms published." }
      },
      {
        eventId: "evt_to_sourcing_godev",
        workflowId: "wf_contract_godev",
        workflowType: "req_lifecycle",
        eventType: "STATE_TRANSITION",
        fromState: RequirementState.ACTIVE,
        toState: RequirementState.SOURCING,
        actorId: "usr_clark",
        organizationId: "org-hn-master",
        timestamp: new Date(Date.now() - 44 * 3600000).toISOString(),
        metadata: { notes: "Assigned partner coordination task." }
      }
    ]
  }
];

export default function WorkflowOrchestrator() {
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states for launching a new workflow
  const [newWorkflowTemplate, setNewWorkflowTemplate] = useState<string>("temp-perm");
  const [newEntityId, setNewEntityId] = useState<string>("req-093");
  const [newHumanOwner, setNewHumanOwner] = useState<string>("Bruce Wayne");
  const [newAIAgent, setNewAIAgent] = useState<string>("recruitment-office");
  const [newSLADeadline, setNewSLADeadline] = useState<number>(48);
  const [newNotes, setNewNotes] = useState<string>("");

  // Transition inline override states
  const [selectedTargetState, setSelectedTargetState] = useState<string>("");
  const [transitionNotes, setTransitionNotes] = useState<string>("");
  const [assignedHumanOverride, setAssignedHumanOverride] = useState<string>("");
  const [assignedAIOverride, setAssignedAIOverride] = useState<string>("");

  // Subscribe to real-time workflow instances
  useEffect(() => {
    const q = query(collection(db, "workflow_instances"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ workflowId: d.id, ...d.data() } as WorkflowInstance));
        setWorkflows(list);
        if (list.length > 0) {
          // Keep selection synchronized or default to first
          setSelectedWorkflow(prev => list.find(w => w.workflowId === prev?.workflowId) || list[0]);
        }
      } else {
        setWorkflows(FALLBACK_WORKFLOWS);
        setSelectedWorkflow(FALLBACK_WORKFLOWS[0]);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "workflow_instances");
      setWorkflows(FALLBACK_WORKFLOWS);
      setSelectedWorkflow(FALLBACK_WORKFLOWS[0]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const activeTemplate = useMemo(() => {
    if (!selectedWorkflow) return null;
    return WORKFLOW_TEMPLATES.find(t => {
      if (selectedWorkflow.workflowType === "req_lifecycle") {
        return t.id === "temp-perm" || t.id === "temp-contract" || t.id === "temp-internal";
      }
      return t.type === selectedWorkflow.workflowType;
    }) || WORKFLOW_TEMPLATES[0];
  }, [selectedWorkflow]);

  // Handle workflow initialization
  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    const template = WORKFLOW_TEMPLATES.find(t => t.id === newWorkflowTemplate) || WORKFLOW_TEMPLATES[0];
    const initialStage = template.stages[0];

    const workflowId = `wf_${Math.random().toString(36).substring(2, 11)}`;
    const deadlineAt = new Date(Date.now() + newSLADeadline * 3600000).toISOString();

    const instance: WorkflowInstance = {
      workflowId,
      workflowType: template.type,
      entityId: newEntityId,
      currentState: initialStage,
      ownerOrgId: "org-hn-master",
      responsibleUsers: [newHumanOwner],
      visibilityScopes: ["global"],
      participantOrganizations: ["org-hn-master"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaTimers: [
        {
          timerId: `sla_${initialStage.toLowerCase()}_${Date.now()}`,
          state: initialStage,
          startedAt: new Date().toISOString(),
          deadlineAt,
          status: "active"
        }
      ],
      riskFlags: [],
      history: [
        {
          eventId: `evt_init_${Date.now()}`,
          workflowId,
          workflowType: template.type,
          eventType: "INITIALIZE_WORKFLOW",
          fromState: initialStage,
          toState: initialStage,
          actorId: "system_admin",
          organizationId: "org-hn-master",
          timestamp: new Date().toISOString(),
          metadata: { 
            notes: newNotes || `${template.name} initialized.`,
            assignedAIAgent: newAIAgent
          }
        }
      ]
    };

    try {
      await setDoc(doc(db, "workflow_instances", workflowId), instance);
      setIsCreateModalOpen(false);
      // Emit corresponding Business event for event-driven orchestration
      await addDoc(collection(db, "platform_events"), {
        id: `evt-${Date.now()}`,
        type: "WORKFLOW_INITIALIZED",
        timestamp: new Date().toISOString(),
        origin: "Workflow Orchestrator",
        status: "nominal",
        payload: {
          workflowId,
          template: template.name,
          entityId: newEntityId,
          currentState: initialStage
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `workflow_instances/${workflowId}`);
    }
  };

  // Perform a workflow state transition
  const handleTransition = async () => {
    if (!selectedWorkflow || !selectedTargetState) return;

    const currentStageIndex = activeTemplate?.stages.indexOf(selectedWorkflow.currentState) ?? -1;
    const targetStageIndex = activeTemplate?.stages.indexOf(selectedTargetState as WorkflowState) ?? -1;
    
    // Close existing active SLA timers and resolve fulfilled ones
    const updatedTimers = selectedWorkflow.slaTimers.map(timer => {
      if (timer.status === "active") {
        return {
          ...timer,
          status: new Date() > new Date(timer.deadlineAt) ? "breached" as const : "fulfilled" as const
        };
      }
      return timer;
    });

    // Start a new SLA timer if we are moving to a non-terminal stage
    const nextSLAHours = activeTemplate?.defaultSLAHours[selectedTargetState as WorkflowState] || 48;
    const isTerminal = targetStageIndex === (activeTemplate?.stages.length ?? 0) - 1;
    
    if (!isTerminal) {
      updatedTimers.push({
        timerId: `sla_${selectedTargetState.toLowerCase()}_${Date.now()}`,
        state: selectedTargetState as WorkflowState,
        startedAt: new Date().toISOString(),
        deadlineAt: new Date(Date.now() + nextSLAHours * 3600000).toISOString(),
        status: "active"
      });
    }

    // Add immutable event to timeline history
    const transitionEvent: WorkflowEvent = {
      eventId: `evt_trans_${Date.now()}`,
      workflowId: selectedWorkflow.workflowId,
      workflowType: selectedWorkflow.workflowType,
      eventType: "STATE_TRANSITION",
      fromState: selectedWorkflow.currentState,
      toState: selectedTargetState as WorkflowState,
      actorId: "system_admin",
      organizationId: "org-hn-master",
      timestamp: new Date().toISOString(),
      metadata: {
        notes: transitionNotes || `Transitioned from ${selectedWorkflow.currentState} to ${selectedTargetState}`,
        assignedHumanOverride: assignedHumanOverride || selectedWorkflow.responsibleUsers[0],
        assignedAIOverride: assignedAIOverride || activeTemplate?.defaultAIAgent
      }
    };

    const updatedWorkflow: WorkflowInstance = {
      ...selectedWorkflow,
      currentState: selectedTargetState as WorkflowState,
      history: [...selectedWorkflow.history, transitionEvent],
      responsibleUsers: assignedHumanOverride ? [assignedHumanOverride] : selectedWorkflow.responsibleUsers,
      slaTimers: updatedTimers,
      updatedAt: new Date().toISOString()
    };

    // Clean up or add risk flags based on state
    if (updatedWorkflow.currentState === RequirementState.INTERVIEWING) {
      updatedWorkflow.riskFlags = updatedWorkflow.riskFlags.filter(f => f.type !== "SLA_BREACH_RISK");
    }

    try {
      await setDoc(doc(db, "workflow_instances", selectedWorkflow.workflowId), updatedWorkflow);
      setSelectedTargetState("");
      setTransitionNotes("");
      setAssignedHumanOverride("");
      setAssignedAIOverride("");

      // Write event logs to platform_events
      await addDoc(collection(db, "platform_events"), {
        id: `evt-trans-${Date.now()}`,
        type: `${selectedWorkflow.workflowType.toUpperCase()}_STAGE_CHANGED`,
        timestamp: new Date().toISOString(),
        origin: "Workflow Orchestrator",
        status: "nominal",
        payload: {
          workflowId: selectedWorkflow.workflowId,
          fromState: selectedWorkflow.currentState,
          toState: selectedTargetState,
          notes: transitionNotes
        }
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `workflow_instances/${selectedWorkflow.workflowId}`);
    }
  };

  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="text-indigo-400" size={20} />
            <h2 className="text-lg font-black text-white">Enterprise Workflow Orchestrator</h2>
          </div>
          <p className="text-xs text-slate-400">Deterministic process mapping, multi-agent participation, and active SLA guardrail enforcement.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-indigo-500/10"
        >
          <PlusCircle size={14} /> Initialize Workflow
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 items-start">
        {/* Workflows List */}
        <div className="xl:col-span-1 space-y-4">
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Active Instances ({workflows.length})</div>
          
          <div className="space-y-2.5 overflow-y-auto max-h-[600px] pr-2">
            {workflows.map((wf) => {
              const isSelected = selectedWorkflow?.workflowId === wf.workflowId;
              const hasBreach = wf.slaTimers.some(t => t.status === "breached");
              const template = WORKFLOW_TEMPLATES.find(t => {
                if (wf.workflowType === "req_lifecycle") {
                  return t.id === "temp-perm" || t.id === "temp-contract" || t.id === "temp-internal";
                }
                return t.type === wf.workflowType;
              }) || WORKFLOW_TEMPLATES[0];

              return (
                <button
                  key={wf.workflowId}
                  onClick={() => setSelectedWorkflow(wf)}
                  className={cn(
                    "w-full p-4 border rounded-2xl flex flex-col items-start gap-2 text-left transition-all relative overflow-hidden group",
                    isSelected 
                      ? "bg-[#0F1424] border-indigo-500/50 text-white shadow-lg" 
                      : "bg-[#070A13] border-slate-900 text-slate-400 hover:border-slate-800 hover:bg-[#0d1222]"
                  )}
                >
                  <div className="flex justify-between items-start w-full gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-slate-500 block mb-0.5">{wf.workflowId}</span>
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{wf.entityId} ({template.name})</h4>
                    </div>
                    <span className={cn(
                      "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      hasBreach 
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse" 
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    )}>
                      {wf.currentState}
                    </span>
                  </div>

                  <div className="flex justify-between items-center w-full text-[10px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1"><User size={10} /> {wf.responsibleUsers[0] || "Unassigned"}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(wf.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Workflow Dashboard */}
        <div className="xl:col-span-2 space-y-6">
          {selectedWorkflow ? (
            <div className="space-y-6 bg-[#070A13] border border-slate-900 rounded-2xl p-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 gap-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block">Operational Timeline</span>
                  <h3 className="text-sm font-black text-white">{selectedWorkflow.entityId} — {activeTemplate?.name}</h3>
                  <p className="text-[10px] text-slate-500">{activeTemplate?.description}</p>
                </div>
                <div className="flex flex-col text-right items-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Current Stage</span>
                  <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full mt-1">
                    {selectedWorkflow.currentState}
                  </span>
                </div>
              </div>

              {/* SLA Timers & Risk Flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900/80 space-y-3">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1"><Clock size={11} /> SLA Monitoring Matrix</span>
                  
                  {selectedWorkflow.slaTimers.map((timer) => {
                    const durationTotal = new Date(timer.deadlineAt).getTime() - new Date(timer.startedAt).getTime();
                    const durationPassed = Date.now() - new Date(timer.startedAt).getTime();
                    const percent = Math.min(100, Math.max(0, (durationPassed / durationTotal) * 100));

                    return (
                      <div key={timer.timerId} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-300 font-bold">{timer.state} SLA Timer</span>
                          <span className={cn(
                            "font-bold uppercase text-[9px]",
                            timer.status === "breached" ? "text-rose-400 animate-pulse" :
                            timer.status === "fulfilled" ? "text-emerald-400" : "text-amber-400"
                          )}>
                            {timer.status}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all",
                              timer.status === "breached" ? "bg-rose-500 w-full" :
                              timer.status === "fulfilled" ? "bg-emerald-500 w-full" : "bg-amber-500"
                            )}
                            style={{ width: timer.status === "active" ? `${percent}%` : "100%" }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500">
                          <span>S: {new Date(timer.startedAt).toLocaleTimeString()}</span>
                          <span>D: {new Date(timer.deadlineAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-900/80 space-y-3">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1"><ShieldAlert size={11} className="text-indigo-400" /> Active Risk Assessments</span>
                  
                  <div className="space-y-2 max-h-[120px] overflow-y-auto">
                    {selectedWorkflow.riskFlags.length > 0 ? (
                      selectedWorkflow.riskFlags.map((risk) => (
                        <div key={risk.flagId} className="p-2 border border-slate-900 rounded-lg bg-[#070A13] flex gap-2 items-start">
                          <AlertTriangle size={12} className={cn(
                            risk.severity === "CRITICAL" ? "text-rose-500" :
                            risk.severity === "HIGH" ? "text-amber-500" : "text-yellow-400"
                          )} />
                          <div>
                            <span className="text-[10px] text-slate-300 font-medium block leading-tight">{risk.message}</span>
                            <span className="text-[8px] text-slate-500 block uppercase font-bold mt-0.5">{risk.severity} Severity • Identified {new Date(risk.identifiedAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-20 flex items-center justify-center border border-dashed border-slate-900 rounded-xl">
                        <span className="text-slate-600 text-[10px] uppercase font-bold">No High Risks Flagged</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline Stage Diagram */}
              <div className="space-y-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Workflow Progression Path</span>
                <div className="flex flex-col md:flex-row justify-between relative pt-6 gap-2">
                  <div className="absolute top-[38px] left-[5%] right-[5%] h-0.5 bg-slate-900 z-0 hidden md:block"></div>
                  
                  {activeTemplate?.stages.map((stage, idx) => {
                    const isPassed = activeTemplate.stages.indexOf(selectedWorkflow.currentState) >= idx;
                    const isCurrent = selectedWorkflow.currentState === stage;

                    return (
                      <div key={stage} className="relative z-10 flex md:flex-col items-center flex-row gap-2 md:gap-0">
                        <div className={cn(
                          "h-6 w-6 rounded-full border flex items-center justify-center transition-all",
                          isCurrent ? "bg-indigo-600 border-indigo-400 ring-4 ring-indigo-500/10 text-white font-black" :
                          isPassed ? "bg-slate-950 border-emerald-500 text-emerald-400" : "bg-slate-950 border-slate-900 text-slate-600"
                        )}>
                          {isCurrent ? idx + 1 : isPassed ? <Check size={10} /> : idx + 1}
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase mt-1 transition-all md:text-center block text-left",
                          isCurrent ? "text-indigo-400" : isPassed ? "text-slate-300" : "text-slate-600"
                        )}>
                          {stage.replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hybrid Work Allocation (Owner & AI Agent) */}
              <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <User size={16} />
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Human Owner</span>
                    <span className="text-xs font-bold text-slate-200 block">{selectedWorkflow.responsibleUsers[0] || "Diana Prince"}</span>
                    <span className="text-[9px] text-slate-500 block">Verification & Escalation Authority</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Bot size={16} />
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Active AIAgent</span>
                    <span className="text-xs font-bold text-slate-200 block">
                      {activeTemplate?.defaultAIAgent === "recruitment-office" ? "Conrad Conductor" :
                       activeTemplate?.defaultAIAgent === "marketplace-office" ? "Max Optimizer" :
                       activeTemplate?.defaultAIAgent === "vendor-office" ? "Vance Vendor" : "Sam Scheduler"}
                    </span>
                    <span className="text-[9px] text-slate-500 block">Layer 1 Digital Employee Sourcing</span>
                  </div>
                </div>
              </div>

              {/* Perform Transition Controls */}
              <div className="space-y-4 border-t border-slate-900 pt-5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1"><Settings size={11} className="text-indigo-400" /> Execute Workflow Step Override</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Target Stage</label>
                    <select
                      value={selectedTargetState}
                      onChange={(e) => setSelectedTargetState(e.target.value)}
                      className="w-full bg-[#070A13] border border-slate-900 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose Stage --</option>
                      {activeTemplate?.stages.map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Human Override</label>
                    <input
                      type="text"
                      placeholder="e.g. Clark Kent"
                      value={assignedHumanOverride}
                      onChange={(e) => setAssignedHumanOverride(e.target.value)}
                      className="w-full bg-[#070A13] border border-slate-900 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">AI Override</label>
                    <input
                      type="text"
                      placeholder="e.g. Vance Coordinator"
                      value={assignedAIOverride}
                      onChange={(e) => setAssignedAIOverride(e.target.value)}
                      className="w-full bg-[#070A13] border border-slate-900 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Notes / Reason</label>
                    <input
                      type="text"
                      placeholder="Transition reasoning details..."
                      value={transitionNotes}
                      onChange={(e) => setTransitionNotes(e.target.value)}
                      className="w-full bg-[#070A13] border border-slate-900 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    disabled={!selectedTargetState}
                    onClick={handleTransition}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900/60 disabled:text-slate-600 text-white transition-all shadow-md shadow-indigo-500/10"
                  >
                    <Play size={11} /> Commit Stage transition <ArrowRight size={11} />
                  </button>
                </div>
              </div>

              {/* Immutable Audit Timeline History */}
              <div className="space-y-3 border-t border-slate-900 pt-5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block flex items-center gap-1"><FileText size={11} className="text-indigo-400" /> Immutable Operational Audit Trail</span>
                
                <div className="space-y-2 relative pl-4 border-l border-slate-900">
                  {selectedWorkflow.history.slice().reverse().map((evt) => (
                    <div key={evt.eventId} className="relative py-2">
                      <div className="absolute -left-[21px] top-4.5 h-2 w-2 rounded-full bg-indigo-500 ring-4 ring-[#070A13]"></div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span className="font-bold text-slate-300 uppercase">{evt.eventType.replace(/_/g, " ")}: {evt.fromState} <ArrowRight size={8} className="inline mx-1" /> {evt.toState}</span>
                        <span>{new Date(evt.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal mt-0.5">{evt.metadata?.notes}</p>
                      {evt.metadata?.assignedHumanOverride && (
                        <div className="flex gap-2 text-[9px] text-indigo-400 mt-1 font-mono">
                          <span>Human: {evt.metadata.assignedHumanOverride}</span>
                          <span>AI: {evt.metadata.assignedAIOverride}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center border border-dashed border-slate-900 rounded-2xl bg-[#070A13]">
              <Workflow size={28} className="text-slate-600 animate-pulse mb-3" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Select an Active Operational Instance to View Timeline</span>
            </div>
          )}
        </div>
      </div>

      {/* Initialize Workflow Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#070A13] border border-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>

            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5"><Workflow size={16} className="text-indigo-400" /> Initialize New Staffing Lifecycle</h3>
              <p className="text-xs text-slate-500 mt-0.5">Launches an event-driven workflow instance tracked across database metrics.</p>
            </div>

            <form onSubmit={handleCreateWorkflow} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Workflow Template</label>
                  <select
                    value={newWorkflowTemplate}
                    onChange={(e) => {
                      setNewWorkflowTemplate(e.target.value);
                      const t = WORKFLOW_TEMPLATES.find(x => x.id === e.target.value);
                      if (t) {
                        setNewAIAgent(t.defaultAIAgent);
                        setNewHumanOwner(t.defaultHumanRole);
                      }
                    }}
                    className="w-full bg-[#0B0F19] border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    {WORKFLOW_TEMPLATES.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Target Entity (Req ID)</label>
                  <input
                    type="text"
                    required
                    value={newEntityId}
                    onChange={(e) => setNewEntityId(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                    placeholder="e.g. req-091"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Default Human Owner</label>
                  <input
                    type="text"
                    required
                    value={newHumanOwner}
                    onChange={(e) => setNewHumanOwner(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Default AI Agent</label>
                  <input
                    type="text"
                    required
                    value={newAIAgent}
                    onChange={(e) => setNewAIAgent(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">First Stage SLA Timer (Hours)</label>
                <input
                  type="number"
                  required
                  value={newSLADeadline}
                  onChange={(e) => setNewSLADeadline(Number(e.target.value))}
                  className="w-full bg-[#0B0F19] border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                  min="1"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Initialization Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-900 rounded-xl p-2.5 text-xs text-white outline-none focus:border-indigo-500 h-20 resize-none"
                  placeholder="Operational context to publish on genesis audit record..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/10"
                >
                  Confirm Genesis Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
