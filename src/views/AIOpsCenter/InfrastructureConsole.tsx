// src/views/AIOpsCenter/InfrastructureConsole.tsx
import React, { useState, useMemo, useEffect } from "react";
import { 
  Server, 
  Cpu, 
  Workflow, 
  Play, 
  RefreshCw, 
  Zap, 
  Terminal as TermIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  Send, 
  Code, 
  Search, 
  Database, 
  Network, 
  Settings, 
  FileCode, 
  Sliders, 
  ExternalLink,
  BookOpen,
  Eye,
  Plus
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

// ============================================================================
// Coolify (Sprint 6) interfaces & configurations
// ============================================================================
interface CoolifyService {
  id: string;
  name: string;
  type: string;
  status: "ACTIVE" | "DEPLOYING" | "SUSPENDED" | "IDLE";
  ingressUrl: string;
  cpu: number;
  memory: number;
  storage: number;
  latencyMs: number;
  dockerImage: string;
  logs: string[];
}

const INITIAL_COOLIFY_SERVICES: CoolifyService[] = [
  {
    id: "cs-01",
    name: "CRM Workspace Core",
    type: "Backend Platform",
    status: "ACTIVE",
    ingressUrl: "https://crm.hirenest.infra",
    cpu: 12.4,
    memory: 1.2,
    storage: 42,
    latencyMs: 15,
    dockerImage: "hirenest/crm-workspace-core:v1.2.0-alpine",
    logs: [
      "[INFO] CRM core services booting up...",
      "[INFO] Database connection pooled: PostgreSQL instance initialized.",
      "[INFO] Active on port 3000.",
      "[INFO] Socket connection established with Event Bus."
    ]
  },
  {
    id: "cs-02",
    name: "OS Workspace Dashboard",
    type: "Frontend SPA",
    status: "ACTIVE",
    ingressUrl: "https://os.hirenest.infra",
    cpu: 2.1,
    memory: 0.35,
    storage: 15,
    latencyMs: 24,
    dockerImage: "hirenest/os-workspace-frontend:v1.0.4",
    logs: [
      "[INFO] UI application serving from Nginx.",
      "[INFO] Static route cache warming initiated.",
      "[INFO] Health check endpoint registered at /healthz."
    ]
  },
  {
    id: "cs-03",
    name: "Ollama Orchestrator Node",
    type: "Model Server",
    status: "IDLE",
    ingressUrl: "https://ollama.hirenest.infra",
    cpu: 0.0,
    memory: 8.5,
    storage: 84,
    latencyMs: 350,
    dockerImage: "ollama/ollama:0.1.48-gpu",
    logs: [
      "[INFO] Ollama server running on cuda:0 GPU core.",
      "[INFO] Loading Llama3:8b parameter model into active VRAM...",
      "[INFO] Model weights cached successfully. Awaiting inference request."
    ]
  },
  {
    id: "cs-04",
    name: "Redis State Broker",
    type: "In-Memory Cache",
    status: "ACTIVE",
    ingressUrl: "https://redis.hirenest.infra",
    cpu: 1.5,
    memory: 0.85,
    storage: 4,
    latencyMs: 2,
    dockerImage: "redis:7.2-alpine",
    logs: [
      "[INFO] Redis key-value store ready on port 6379.",
      "[INFO] Session snapshot backup loaded: 4,210 keys restored.",
      "[INFO] Master-Slave persistence synchronization active."
    ]
  },
  {
    id: "cs-05",
    name: "Qdrant Vector Database",
    type: "Vector Database",
    status: "ACTIVE",
    ingressUrl: "https://qdrant.hirenest.infra",
    cpu: 4.8,
    memory: 2.4,
    storage: 52,
    latencyMs: 8,
    dockerImage: "qdrant/qdrant:v1.9.3",
    logs: [
      "[INFO] Qdrant storage engine online.",
      "[INFO] Loaded collection: candidate_embeddings (768-dim, Cosine distance).",
      "[INFO] Loaded collection: requirement_embeddings (768-dim, Cosine distance).",
      "[INFO] Index optimization finished in 1.4 seconds."
    ]
  },
  {
    id: "cs-06",
    name: "n8n Workflow Runtime",
    type: "Automation Runtime",
    status: "ACTIVE",
    ingressUrl: "https://n8n.hirenest.infra",
    cpu: 0.8,
    memory: 0.65,
    storage: 18,
    latencyMs: 45,
    dockerImage: "n8nio/n8n:1.45.1",
    logs: [
      "[INFO] n8n automation scheduler running.",
      "[INFO] Webhook endpoints initialized for Slack & WhatsApp integrations.",
      "[INFO] Loaded 12 active recruitment workflows into runtime ledger."
    ]
  },
  {
    id: "cs-07",
    name: "HireNest AI Gateway",
    type: "API Proxy & Router",
    status: "ACTIVE",
    ingressUrl: "https://gateway.hirenest.infra",
    cpu: 18.2,
    memory: 1.5,
    storage: 8,
    latencyMs: 12,
    dockerImage: "hirenest/ai-gateway:v2.1-rust",
    logs: [
      "[INFO] AI Gateway Proxy booting on Rust server core.",
      "[INFO] Loading routing weights: Gemini 80%, Claude 20%.",
      "[INFO] Circuit breakers armed at 5% fail-rate threshold.",
      "[INFO] JWT authorization middleware successfully bound."
    ]
  }
];

// ============================================================================
// Open WebUI (Sprint 7) interfaces & configurations
// ============================================================================
interface WebUIModel {
  id: string;
  name: string;
  provider: string;
  status: "CONNECTED" | "INACTIVE";
  latencyMs: number;
  costPerMillion: number;
}

const CONNECTED_MODELS: WebUIModel[] = [
  { id: "gemini-31-pro", name: "Gemini 3.1 Pro Preview", provider: "Google AI", status: "CONNECTED", latencyMs: 850, costPerMillion: 1.25 },
  { id: "gemini-36-flash", name: "Gemini 3.6 Flash", provider: "Google AI", status: "CONNECTED", latencyMs: 320, costPerMillion: 0.15 },
  { id: "claude-35-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", status: "CONNECTED", latencyMs: 950, costPerMillion: 3.00 },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", status: "CONNECTED", latencyMs: 780, costPerMillion: 5.00 },
  { id: "llama-3-8b", name: "Llama3:8b (Ollama Local)", provider: "Local Ollama GPU", status: "CONNECTED", latencyMs: 420, costPerMillion: 0.00 },
  { id: "deepseek-coder", name: "DeepSeek Coder V2", provider: "DeepSeek API", status: "INACTIVE", latencyMs: 1450, costPerMillion: 0.14 },
  { id: "qwen-25", name: "Qwen 2.5 (72b)", provider: "Alibaba Cloud", status: "INACTIVE", latencyMs: 1800, costPerMillion: 0.40 }
];

const PRESET_WORKFLOW_PROMPTS = [
  {
    label: "Draft candidate outreach email",
    prompt: "Write a personalized, concise email reaching out to a Senior Kubernetes Platform Architect who has outstanding vector-matching alignment with our TechCorp requirement. Highlight our hybrid tech ecosystem (Coolify, Qdrant, Ollama)."
  },
  {
    label: "Analyze intake requirement risks",
    prompt: "Review the 'Lead Go Developer' role description from Initech. Detect potential hiring bottlenecks, assess the availability of skills, and output a structured operational checklist for BDM routing overrides."
  },
  {
    label: "Assess strategic bench capabilities",
    prompt: "Compare vendor benches from Apex Staffing and TechAllies. Analyze trust scores, latency SLA records, and outline which partner has superior semantic depth for a Cloud Security Engineer opening."
  }
];

// ============================================================================
// Langflow (Sprint 8) interfaces & configurations
// ============================================================================
interface FlowNode {
  id: string;
  label: string;
  type: "trigger" | "model" | "agent" | "db" | "action";
  config: Record<string, string | number>;
}

const LANGFLOW_PIPELINES = [
  {
    id: "pipe-01",
    name: "AI Talent Ingest & Screening Loop",
    desc: "Autonomous incoming resume pipeline. Ingests PDFs, extracts content via OCR, vectorizes skills, and indexes into Qdrant.",
    nodes: [
      { id: "node-1", label: "PDF File Intake Trigger", type: "trigger", config: { source: "Vance portal or emails", limit: "Unbound" } },
      { id: "node-2", label: "Extract Text API Parser", type: "agent", config: { timeout: "5000ms", fallback: "OCR service" } },
      { id: "node-3", label: "Gemini Embeddings Generator", type: "model", config: { dimension: 768, batchSize: 32 } },
      { id: "node-4", label: "Qdrant Indexer Storage", type: "db", config: { collection: "candidate_matches", index: "HNSW" } },
      { id: "node-5", label: "Slack Sync & Ledger Entry", type: "action", config: { channel: "#sourcing-alerts", ledger: "ACTIVE" } }
    ]
  },
  {
    id: "pipe-02",
    name: "Client Intake to BDM Routing Loop",
    desc: "Analyzes incoming requirements, detects ownership SLA overlaps, executes semantic matching, and assigns to the optimal hybrid agent.",
    nodes: [
      { id: "node-1", label: "New Requirement Signal", type: "trigger", config: { checkPeriod: "Realtime", collection: "requirements" } },
      { id: "node-2", label: "Requirement Intel Analyzer", type: "agent", config: { cognitivePower: "gemini-3.1-pro-preview", extractSkills: true } },
      { id: "node-3", label: "Active Bench Match Query", type: "db", config: { vectorLimit: 100, scoreThreshold: 0.82 } },
      { id: "node-4", label: "Strategic BDM Routing Rules", type: "action", config: { fallbackOwner: "Diana Prince", ruleSLA: "12 Hours" } }
    ]
  }
];

// ============================================================================
// OpenHands (Sprint 9) interfaces & configurations
// ============================================================================
interface CodingTask {
  id: string;
  title: string;
  status: "PENDING" | "RUNNING" | "VERIFIED" | "FAILED";
  affectedFile: string;
  instruction: string;
  progress: string[];
}

const INITIAL_CODING_TASKS: CodingTask[] = [
  {
    id: "task-01",
    title: "Inject Firestore Caching Layer into API route",
    status: "VERIFIED",
    affectedFile: "/src/api/extract-text.ts",
    instruction: "Add Redis memory cache wrapper around document text extractions to bypass redundant OCR calls and save computation costs.",
    progress: [
      "[INFO] Checking workspace files...",
      "[INFO] OpenHands reading '/src/api/extract-text.ts'...",
      "[INFO] Modifying file: added Redis check block at line 24, and cache.set block at line 142.",
      "[INFO] Generating test suite: checking validation logic for mock file buffers.",
      "[INFO] Running build: 'npm run build' - SUCCESS",
      "[INFO] Executing unit tests: 'npx tsc --noEmit' - SUCCESS",
      "[INFO] Added change: Git diff committed automatically to branch feature/redis-caching."
    ]
  },
  {
    id: "task-02",
    title: "Generate Integrity Test Suite for Candidate Matches",
    status: "PENDING",
    affectedFile: "/src/tests/candidateMatchIntegrity.test.ts",
    instruction: "Write strict unit tests that verify candidate_matches matches always source from the single source of truth Firestore schema and validate against ABAC limits.",
    progress: []
  },
  {
    id: "task-03",
    title: "Harden Text Extract Security Boundaries",
    status: "PENDING",
    affectedFile: "/src/api/extract-text.ts",
    instruction: "Examine incoming HTTP payload size. Force strict size checks (max 10MB) and validate file mime-types against secure whitelist.",
    progress: []
  }
];

// ============================================================================
// Crawl4AI (Sprint 10) interfaces & configurations
// ============================================================================
interface KnowledgeEntity {
  id: string;
  label: string;
  type: "ORGANIZATION" | "JOB_ROLE" | "SKILL" | "METRIC";
  connections: string[];
}

const INITIAL_KNOWLEDGE_ENTITIES: KnowledgeEntity[] = [
  { id: "ent-1", label: "TechCorp Inc.", type: "ORGANIZATION", connections: ["Platform Architect", "Kubernetes", "150k Placement"] },
  { id: "ent-2", label: "Platform Architect", type: "JOB_ROLE", connections: ["TechCorp Inc.", "Kubernetes", "Go Language"] },
  { id: "ent-3", label: "Kubernetes", type: "SKILL", connections: ["Platform Architect", "Go Language", "Qdrant Index"] },
  { id: "ent-4", label: "Go Language", type: "SKILL", connections: ["Platform Architect", "Kubernetes"] },
  { id: "ent-5", label: "Qdrant Index", type: "SKILL", connections: ["Kubernetes", "TechCorp Inc."] },
  { id: "ent-6", label: "150k Placement", type: "METRIC", connections: ["TechCorp Inc.", "Platform Architect"] }
];


export default function InfrastructureConsole() {
  const [activeTab, setActiveTab] = useState<"coolify" | "webui" | "langflow" | "openhands" | "crawl">("coolify");

  // Coolify state
  const [coolifyServices, setCoolifyServices] = useState<CoolifyService[]>(INITIAL_COOLIFY_SERVICES);
  const [activeServiceId, setActiveServiceId] = useState<string>("cs-01");
  const [activeServiceLogs, setActiveServiceLogs] = useState<string[]>(INITIAL_COOLIFY_SERVICES[0].logs);
  const [isDeployingService, setIsDeployingService] = useState<string | null>(null);

  // Open WebUI state
  const [models, setModels] = useState<WebUIModel[]>(CONNECTED_MODELS);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>("gemini-31-pro");
  const [chatPrompt, setChatPrompt] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string; metrics?: string }[]>([
    { 
      role: "assistant", 
      content: "Hello! I am connected to the HireNest AI Workspace. Select an active model API above, write a prompt or pick a recruitment preset, and let's test our semantic capabilities.",
      metrics: "System Handshake • Latency: 0ms • Cost: $0.00"
    }
  ]);

  // Langflow state
  const [pipelines, setPipelines] = useState(LANGFLOW_PIPELINES);
  const [activePipelineId, setActivePipelineId] = useState<string>("pipe-01");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-1");
  const [isTestingPipeline, setIsTestingPipeline] = useState<boolean>(false);
  const [pipelineTestLogs, setPipelineTestLogs] = useState<string[]>([]);
  const [pipelineCompleted, setPipelineCompleted] = useState<boolean>(false);

  // OpenHands state
  const [codingTasks, setCodingTasks] = useState<CodingTask[]>(INITIAL_CODING_TASKS);
  const [activeTaskId, setActiveTaskId] = useState<string>("task-01");
  const [dispatchPrompt, setDispatchPrompt] = useState<string>("");
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  // Crawl4AI state
  const [crawlUrl, setCrawlUrl] = useState<string>("https://www.linkedin.com/jobs/react-engineer");
  const [isCrawling, setIsCrawling] = useState<boolean>(false);
  const [crawlLogs, setCrawlLogs] = useState<string[]>([]);
  const [crawledContent, setCrawledContent] = useState<string | null>(null);
  const [knowledgeEntities, setKnowledgeEntities] = useState<KnowledgeEntity[]>(INITIAL_KNOWLEDGE_ENTITIES);
  const [newEntityLabel, setNewEntityLabel] = useState<string>("");
  const [newEntityType, setNewEntityType] = useState<"ORGANIZATION" | "JOB_ROLE" | "SKILL" | "METRIC">("SKILL");

  const activeService = useMemo(() => {
    return coolifyServices.find(s => s.id === activeServiceId) || coolifyServices[0];
  }, [coolifyServices, activeServiceId]);

  const activePipeline = useMemo(() => {
    return pipelines.find(p => p.id === activePipelineId) || pipelines[0];
  }, [pipelines, activePipelineId]);

  const activeNode = useMemo(() => {
    return activePipeline.nodes.find(n => n.id === selectedNodeId) || activePipeline.nodes[0];
  }, [activePipeline, selectedNodeId]);

  const activeCodingTask = useMemo(() => {
    return codingTasks.find(t => t.id === activeTaskId) || codingTasks[0];
  }, [codingTasks, activeTaskId]);


  // Coolify Interactions
  const handleDeployService = (id: string) => {
    setIsDeployingService(id);
    setCoolifyServices(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          status: "DEPLOYING",
          logs: [...s.logs, `[ACTION] Pulling image: ${s.dockerImage}`, `[ACTION] Deploying Docker stack node on cluster...`]
        };
      }
      return s;
    }));

    if (id === activeServiceId) {
      setActiveServiceLogs(prev => [...prev, `[ACTION] Pulling image: ${activeService.dockerImage}`, `[ACTION] Deploying Docker stack node on cluster...`]);
    }

    setTimeout(() => {
      setCoolifyServices(prev => prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            status: "ACTIVE",
            cpu: Math.floor(Math.random() * 20) + 1,
            memory: Number((Math.random() * 4).toFixed(2)),
            logs: [...s.logs, `[SUCCESS] Deployment complete. Ingress active: ${s.ingressUrl}`, `[INFO] Connection verified (uptime 100%).`]
          };
        }
        return s;
      }));

      if (id === activeServiceId) {
        setActiveServiceLogs(prev => [...prev, `[SUCCESS] Deployment complete. Ingress active: ${activeService.ingressUrl}`, `[INFO] Connection verified (uptime 100%).`]);
      }
      setIsDeployingService(null);
    }, 4000);
  };

  const handleStopService = (id: string) => {
    setCoolifyServices(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          status: "SUSPENDED",
          cpu: 0,
          memory: 0,
          logs: [...s.logs, `[WARN] Service manually suspended. Ingress disabled.`, `[INFO] Container resources reclaimed.`]
        };
      }
      return s;
    }));

    if (id === activeServiceId) {
      setActiveServiceLogs(prev => [...prev, `[WARN] Service manually suspended. Ingress disabled.`, `[INFO] Container resources reclaimed.`]);
    }
  };

  const handleRestartService = (id: string) => {
    setCoolifyServices(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          status: "DEPLOYING",
          logs: [...s.logs, `[ACTION] Restarting container. Releasing memory lock...`]
        };
      }
      return s;
    }));

    if (id === activeServiceId) {
      setActiveServiceLogs(prev => [...prev, `[ACTION] Restarting container. Releasing memory lock...`]);
    }

    setTimeout(() => {
      setCoolifyServices(prev => prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            status: "ACTIVE",
            logs: [...s.logs, `[SUCCESS] Service rebooted. Ready to accept connections.`]
          };
        }
        return s;
      }));

      if (id === activeServiceId) {
        setActiveServiceLogs(prev => [...prev, `[SUCCESS] Service rebooted. Ready to accept connections.`]);
      }
    }, 2500);
  };

  // Open WebUI Interactions
  const handleTestModel = (id: string) => {
    setTestingModelId(id);
    setTimeout(() => {
      setModels(prev => prev.map(m => {
        if (m.id === id) {
          return { ...m, status: "CONNECTED" };
        }
        return m;
      }));
      setTestingModelId(null);
    }, 1500);
  };

  const handleSendPrompt = (customPrompt?: string) => {
    const promptToSend = customPrompt || chatPrompt;
    if (!promptToSend.trim()) return;

    setChatMessages(prev => [...prev, { role: "user", content: promptToSend }]);
    setChatPrompt("");
    setIsChatLoading(true);

    const activeModel = models.find(m => m.id === selectedModelId) || models[0];

    setTimeout(() => {
      let assistantReply = "";
      if (promptToSend.toLowerCase().includes("email") || promptToSend.toLowerCase().includes("outreach")) {
        assistantReply = `Subject: Sourcing Opening: Senior Platform Architect position at TechCorp Inc.\n\nDear Lead Candidate,\n\nI am Emma, your Lead Cognitive Recruiter here at HireNest. I recently performed a semantic match review over our tech-allies recruitment bench and identified your remarkable background in high-performance cloud container infrastructure.\n\nWe would love to discuss a fully-hybrid Lead Platform Architect role at TechCorp ($150,000 baseline). Our infrastructure stacks are fully automated using Coolify, n8n, and local Ollama GPU runners which allows engineers to deploy fast, secure pipelines without red-tape bureaucracy.\n\nIf you are interested, please let me know your availability for a brief technical screening call.\n\nBest regards,\nEmma (AI Recruiter)`;
      } else if (promptToSend.toLowerCase().includes("risk") || promptToSend.toLowerCase().includes("intake")) {
        assistantReply = `### Requirement Intelligence & Risk Assessment: Lead Go Developer\n\n**1. Market Skill Sourcing Risk**: HIGH. High-concurrency Go developers with Kubernetes operator expertise are in severe demand. Average time-to-fill exceeds 24 days in APAC region.\n\n**2. Core Requirements Detected**:\n- Go (Advanced routines, Context architecture, channels)\n- Kubernetes Operator SDK & Custom Resource Definitions (CRDs)\n- Qdrant Embedding Indexes & Redis structures\n\n**3. Strategic Advice**: Trigger global sourcing agent (Conrad Recruiter Conductor) event immediately to crawl bench pipelines and bypass manual queue review limits to capture premium talent within 4 hours.`;
      } else {
        assistantReply = `Thank you for testing the HireNest AI Workspace with ${activeModel.name}. Here are the results of your operational query:\n\n- **Grounded Source**: candidate_matches collection\n- **Execution Status**: Handled via AI Gateway routing weights\n- **Semantic Match Confidence**: 0.94\n\nWe have successfully synchronized the intelligence ledger. This recommendation is fully actionable and logged under decision audit files.`;
      }

      const latency = activeModel.latencyMs + Math.floor(Math.random() * 80) - 40;
      const calculatedCost = (promptToSend.length * 0.0000015 + assistantReply.length * 0.000004) * activeModel.costPerMillion;

      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: assistantReply,
        metrics: `Model: ${activeModel.name} • Latency: ${latency}ms • Cost: $${calculatedCost.toFixed(5)}`
      }]);
      setIsChatLoading(false);
    }, 2000);
  };

  // Langflow Interactions
  const handleRunPipelineTest = () => {
    setIsTestingPipeline(true);
    setPipelineCompleted(false);
    setPipelineTestLogs(["[START] Initiating visual node automation test pipeline..."]);

    const steps = [
      () => setPipelineTestLogs(prev => [...prev, `[NODE: Trigger] Active: Ingestion trigger parsed incoming request. Received 1 payload.`]),
      () => setPipelineTestLogs(prev => [...prev, `[NODE: Agent] Cognitive worker parsed file buffer and extracted skills in 1.4 seconds.`]),
      () => setPipelineTestLogs(prev => [...prev, `[NODE: Model] Embedded skills vectorized successfully. 768-dim floating vectors generated.`]),
      () => setPipelineTestLogs(prev => [...prev, `[NODE: Database] Executed cosine-distance lookup. Matched candidate in candidate_matches index.`]),
      () => {
        setPipelineTestLogs(prev => [...prev, `[SUCCESS] Pipeline executed flawlessly. Event synchronized in Firestore SSOT.`, `[INFO] Ledger entry: cand-102 matched with TechCorp - SLA verified.`]);
        setPipelineCompleted(true);
        setIsTestingPipeline(false);
      }
    ];

    steps.forEach((stepFn, index) => {
      setTimeout(stepFn, (index + 1) * 1500);
    });
  };

  // OpenHands Interactions
  const handleDispatchCodingTask = () => {
    if (!dispatchPrompt.trim()) return;

    const newTask: CodingTask = {
      id: `task-${Date.now().toString().slice(-2)}`,
      title: dispatchPrompt.slice(0, 42) + "...",
      status: "RUNNING",
      affectedFile: "/src/server.ts",
      instruction: dispatchPrompt,
      progress: [
        "[INFO] Initializing OpenHands software agent...",
        "[INFO] Inspecting codebase hierarchy for related modules..."
      ]
    };

    setCodingTasks(prev => [...prev, newTask]);
    setActiveTaskId(newTask.id);
    setDispatchPrompt("");
    setIsDispatching(true);

    const steps = [
      () => setCodingTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, progress: [...t.progress, `[INFO] Parsing instruction: "${newTask.instruction}"`] } : t)),
      () => setCodingTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, progress: [...t.progress, `[INFO] Modifying /src/server.ts to append safety handler filters.`] } : t)),
      () => setCodingTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, progress: [...t.progress, `[INFO] Executing linter: 'npm run lint' - PASSED (0 warnings)`] } : t)),
      () => setCodingTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, status: "VERIFIED", progress: [...t.progress, `[SUCCESS] Build verified. Git branch pushed and ready for review.`] } : t))
    ];

    steps.forEach((stepFn, index) => {
      setTimeout(() => {
        stepFn();
        if (index === steps.length - 1) {
          setIsDispatching(false);
        }
      }, (index + 1) * 2000);
    });
  };

  // Crawl4AI Interactions
  const handleStartCrawl = () => {
    if (!crawlUrl.trim()) return;
    setIsCrawling(true);
    setCrawledContent(null);
    setCrawlLogs(["[START] Instantiating Crawl4AI headless scraper browser...", "[INFO] Resolving URL DNS and performing security handshake..."]);

    const steps = [
      () => setCrawlLogs(prev => [...prev, `[CRAWLING] Successfully fetched page payload. Content length: 142KB. Raw HTML received.`]),
      () => setCrawlLogs(prev => [...prev, `[CLEANING] Stripped boilerplate header scripts, SVG definitions, and styles. Extracted pure semantic text.`]),
      () => setCrawlLogs(prev => [...prev, `[MARKDOWN] Converted text layout to structured Markdown headings & lists.`]),
      () => setCrawlLogs(prev => [...prev, `[VECTORIZING] Generated skill embeddings. Inserted 4 node embeddings into Qdrant.`]),
      () => {
        setCrawlLogs(prev => [...prev, `[KNOWLEDGE GRAPH] Extracted entities and updated Enterprise relationships.`, `[SUCCESS] Crawl completed in 5.2 seconds.`]);
        
        setCrawledContent(`## TechCorp Job Post: Lead React Engineer\n\n**Location**: Fully Remote, US / APAC Hybrid\n**Salary Range**: $130,000 - $160,000\n\n### Tech Stack Requirements\n- **Vite & React 19** with Tailwind CSS\n- **TypeScript** standard compilation & strict structures\n- **D3.js or Recharts** complex dashboard analytics\n- **Firestore DB** direct integration and live synchronizations\n\n### Core Mission\nJoin our recruitment platform team and build modular client dashboards that support millions of candidate vector screenings.`);
        
        // Add parsed entities
        setKnowledgeEntities(prev => [
          ...prev,
          { id: "ent-new1", label: "React 19", type: "SKILL", connections: ["Platform Architect", "Vite & Tailwind"] },
          { id: "ent-new2", label: "Vite & Tailwind", type: "SKILL", connections: ["React 19", "TechCorp Inc."] }
        ]);

        setIsCrawling(false);
      }
    ];

    steps.forEach((stepFn, index) => {
      setTimeout(stepFn, (index + 1) * 1500);
    });
  };

  const handleAddKnowledgeEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityLabel.trim()) return;

    const newEnt: KnowledgeEntity = {
      id: `ent-${Date.now().toString().slice(-3)}`,
      label: newEntityLabel,
      type: newEntityType,
      connections: ["TechCorp Inc.", "Kubernetes"]
    };

    setKnowledgeEntities(prev => [newEnt, ...prev]);
    setNewEntityLabel("");
  };


  return (
    <div className="space-y-6 flex-1 flex flex-col">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-900 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-black text-white">AI Developer & Infrastructure Console</h2>
          <p className="text-xs text-slate-400">Live orchestration environment managing Coolify, Open WebUI workspaces, Langflow visual designers, OpenHands coding loops, and Crawl4AI knowledge vectors.</p>
        </div>
        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full font-bold">
          Kubernetes Clusters: ACTIVE
        </span>
      </div>

      {/* 2. Horizontal Mini-SubTabs Menu */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 shrink-0">
        <button
          onClick={() => setActiveTab("coolify")}
          className={cn("px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1.5",
            activeTab === "coolify" ? "bg-indigo-600/15 border-indigo-500 text-white shadow shadow-indigo-500/10" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:text-white"
          )}
        >
          <Server size={14} className={activeTab === "coolify" ? "text-indigo-400" : "text-slate-500"} />
          <span>Sprint 6: Coolify</span>
        </button>

        <button
          onClick={() => setActiveTab("webui")}
          className={cn("px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1.5",
            activeTab === "webui" ? "bg-indigo-600/15 border-indigo-500 text-white shadow shadow-indigo-500/10" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:text-white"
          )}
        >
          <Cpu size={14} className={activeTab === "webui" ? "text-indigo-400" : "text-slate-500"} />
          <span>Sprint 7: Open WebUI</span>
        </button>

        <button
          onClick={() => setActiveTab("langflow")}
          className={cn("px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1.5",
            activeTab === "langflow" ? "bg-indigo-600/15 border-indigo-500 text-white shadow shadow-indigo-500/10" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:text-white"
          )}
        >
          <Workflow size={14} className={activeTab === "langflow" ? "text-indigo-400" : "text-slate-500"} />
          <span>Sprint 8: Langflow</span>
        </button>

        <button
          onClick={() => setActiveTab("openhands")}
          className={cn("px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1.5",
            activeTab === "openhands" ? "bg-indigo-600/15 border-indigo-500 text-white shadow shadow-indigo-500/10" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:text-white"
          )}
        >
          <Code size={14} className={activeTab === "openhands" ? "text-indigo-400" : "text-slate-500"} />
          <span>Sprint 9: OpenHands</span>
        </button>

        <button
          onClick={() => setActiveTab("crawl")}
          className={cn("px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1.5 col-span-2 md:col-span-1",
            activeTab === "crawl" ? "bg-indigo-600/15 border-indigo-500 text-white shadow shadow-indigo-500/10" : "bg-[#0B0F19] border-slate-900/60 text-slate-400 hover:text-white"
          )}
        >
          <Search size={14} className={activeTab === "crawl" ? "text-indigo-400" : "text-slate-500"} />
          <span>Sprint 10: Crawl4AI</span>
        </button>
      </div>

      {/* 3. Tab Workspaces */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* ====================================================================
            COOLIFY WORKSPACE (Sprint 6)
            ==================================================================== */}
        {activeTab === "coolify" && (
          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            
            {/* Services List Grid */}
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center pb-2">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Ecosystem Stack Nodes</span>
                <span className="text-[10px] text-slate-500">Deploy & monitor core infrastructure modules</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[500px] pr-1">
                {coolifyServices.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => {
                      setActiveServiceId(srv.id);
                      setActiveServiceLogs(srv.logs);
                    }}
                    className={cn("p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group",
                      activeServiceId === srv.id ? "bg-indigo-600/5 border-indigo-500" : "bg-[#070A13] border-slate-900 hover:border-slate-800"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black text-white block">{srv.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{srv.type}</span>
                      </div>
                      <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1",
                        srv.status === "ACTIVE" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        srv.status === "DEPLOYING" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse" :
                        srv.status === "SUSPENDED" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                        "bg-slate-500/10 border-slate-500/20 text-slate-400"
                      )}>
                        {srv.status === "ACTIVE" && <span className="h-1 w-1 bg-emerald-400 rounded-full animate-ping" />}
                        {srv.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-900/60 text-center font-mono">
                      <div>
                        <span className="text-[8px] text-slate-500 block">CPU</span>
                        <span className="text-[10px] font-bold text-slate-300">{srv.cpu}%</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-500 block">MEM</span>
                        <span className="text-[10px] font-bold text-slate-300">{srv.memory} GB</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-500 block">LATENCY</span>
                        <span className="text-[10px] font-bold text-slate-300">{srv.latencyMs}ms</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[9px] border-t border-slate-900/30 pt-2 opacity-80">
                      <span className="text-slate-500 truncate max-w-[140px]">{srv.ingressUrl}</span>
                      <div className="flex gap-2">
                        {srv.status !== "ACTIVE" && srv.status !== "DEPLOYING" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeployService(srv.id); }}
                            className="text-indigo-400 hover:text-indigo-300 font-bold uppercase"
                          >
                            Deploy
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStopService(srv.id); }}
                            className="text-rose-400 hover:text-rose-300 font-bold uppercase"
                            disabled={srv.status === "DEPLOYING"}
                          >
                            Stop
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRestartService(srv.id); }}
                          className="text-slate-400 hover:text-white font-bold uppercase"
                          disabled={srv.status === "DEPLOYING"}
                        >
                          Reboot
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Logs and Actions Terminal */}
            <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="border-b border-slate-900 pb-3 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Docker Stack Auditor</span>
                    <h4 className="text-sm font-black text-white">{activeService.name}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">{activeService.dockerImage}</span>
                </div>

                <div className="bg-slate-950/80 p-4 border border-slate-900 rounded-2xl space-y-2 text-xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Container Parameters</span>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Kubernetes Ingress:</span>
                    <a href={activeService.ingressUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-mono text-[10px] flex items-center gap-1">
                      {activeService.ingressUrl} <ExternalLink size={10} />
                    </a>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Deployment Engine:</span>
                    <span className="text-slate-300 font-bold">Coolify Cloud Node #1</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Health Check Status:</span>
                    <span className="font-bold text-emerald-400 font-mono">100% SUCCESS RATIO</span>
                  </div>
                </div>

                {/* Simulated Logs Terminal */}
                <div className="flex-1 flex flex-col space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">System Logs Output</span>
                  <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-[10px] text-slate-400 overflow-y-auto max-h-[220px] space-y-1.5 select-text">
                    {activeServiceLogs.map((log, idx) => (
                      <div key={idx} className={cn(
                        log.includes("[SUCCESS]") ? "text-emerald-400" :
                        log.includes("[WARN]") ? "text-amber-400" :
                        log.includes("[ACTION]") ? "text-indigo-400 animate-pulse" : "text-slate-400"
                      )}>
                        {log}
                      </div>
                    ))}
                    {isDeployingService === activeServiceId && (
                      <div className="text-indigo-400 animate-pulse">[ACTION] Spinning up cluster replica...</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-900/60 flex gap-2 shrink-0">
                <button
                  onClick={() => handleDeployService(activeService.id)}
                  disabled={activeService.status === "DEPLOYING"}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Play size={13} /> Re-deploy Service
                </button>
                <button
                  onClick={() => handleRestartService(activeService.id)}
                  disabled={activeService.status === "DEPLOYING"}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-950 border border-slate-900 text-slate-400 hover:text-white transition-all disabled:opacity-50"
                >
                  Reboot
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            OPEN WEBUI WORKSPACE (Sprint 7)
            ==================================================================== */}
        {activeTab === "webui" && (
          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            
            {/* Model connections panel */}
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center pb-2">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">AI Model Workspace Hub</span>
                <span className="text-[10px] text-slate-500">Connected cognitive models & pricing indicators</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[500px] pr-1">
                {models.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (m.status === "CONNECTED") {
                        setSelectedModelId(m.id);
                      }
                    }}
                    className={cn("p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer",
                      selectedModelId === m.id ? "bg-indigo-600/5 border-indigo-500" : "bg-[#070A13] border-slate-900 hover:border-slate-800",
                      m.status === "INACTIVE" && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black text-white block">{m.name}</span>
                        <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{m.provider}</span>
                      </div>
                      <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1",
                        m.status === "CONNECTED" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        "bg-slate-500/10 border-slate-500/20 text-slate-400"
                      )}>
                        {m.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-900/60 text-left font-mono">
                      <div>
                        <span className="text-[8px] text-slate-500 block">API LATENCY</span>
                        <span className="text-[10px] font-bold text-slate-300">{m.latencyMs} ms</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-500 block">COST / 1M TOKENS</span>
                        <span className="text-[10px] font-bold text-slate-300">${m.costPerMillion.toFixed(2)}</span>
                      </div>
                    </div>

                    {m.status === "INACTIVE" && (
                      <div className="mt-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTestModel(m.id); }}
                          disabled={testingModelId === m.id}
                          className="py-1 px-3 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[9px] font-bold text-white transition-all"
                        >
                          {testingModelId === m.id ? "Testing..." : "Connect Model"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Workspace */}
            <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
              
              {/* Chat Header */}
              <div className="border-b border-slate-900 pb-3 flex justify-between items-center shrink-0">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Connected Playground</span>
                  <h4 className="text-sm font-black text-white">Interactive Sourcing Workspace</h4>
                </div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                  {models.find(m => m.id === selectedModelId)?.name || "Gemini Pro"}
                </span>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto max-h-[250px] space-y-4 py-4 pr-1 scrollbar-none select-text">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={cn("space-y-1 text-xs max-w-[90%]",
                    msg.role === "user" ? "ml-auto text-right" : "mr-auto text-left"
                  )}>
                    <div className={cn("p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap",
                      msg.role === "user" ? "bg-indigo-600 text-white rounded-br-none" : "bg-[#0b101d] border border-slate-900 text-slate-300 rounded-bl-none"
                    )}>
                      {msg.content}
                    </div>
                    {msg.metrics && (
                      <span className="text-[8px] font-mono text-slate-500 block px-1">{msg.metrics}</span>
                    )}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="space-y-1 text-xs max-w-[90%] mr-auto">
                    <div className="p-3.5 rounded-2xl bg-[#0b101d] border border-slate-900 text-slate-400 animate-pulse rounded-bl-none">
                      Generating token streams... Analysing model reasoning pathways...
                    </div>
                  </div>
                )}
              </div>

              {/* Pre-sets triggers */}
              <div className="pb-3 border-t border-slate-900/40 pt-3 shrink-0">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Sourcing Presets Trigger</span>
                <div className="flex flex-col gap-1.5">
                  {PRESET_WORKFLOW_PROMPTS.map((pre, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendPrompt(pre.prompt)}
                      disabled={isChatLoading}
                      className="w-full text-left p-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 transition-colors text-[10px] text-slate-300 truncate font-medium disabled:opacity-50"
                    >
                      💡 {pre.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input form */}
              <div className="border-b border-slate-900/40 pb-2 shrink-0" />
              <div className="pt-3 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendPrompt(); }}
                  disabled={isChatLoading}
                  placeholder="Ask Gemini or Llama about sourcing rules..."
                  className="flex-1 bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-indigo-500/40 outline-none"
                />
                <button
                  onClick={() => handleSendPrompt()}
                  disabled={isChatLoading || !chatPrompt.trim()}
                  className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            LANGFLOW WORKSPACE (Sprint 8)
            ==================================================================== */}
        {activeTab === "langflow" && (
          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            
            {/* Visual Node Diagram Designer */}
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center pb-2 shrink-0">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">Visual Automation Studio</span>
                  <span className="text-[10px] text-slate-500">Drag-and-Drop Agents, DB Connectors, & AI Pipelines</span>
                </div>
                
                <div className="flex gap-2">
                  <select
                    value={activePipelineId}
                    onChange={(e) => {
                      setActivePipelineId(e.target.value);
                      setSelectedNodeId("node-1");
                      setPipelineCompleted(false);
                      setPipelineTestLogs([]);
                    }}
                    className="bg-[#070A13] border border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none"
                  >
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Flowchart Representation using cards */}
              <div className="bg-[#070A13] border border-slate-900 rounded-3xl p-6 min-h-[350px] relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Workflow size={240} className="text-indigo-500" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
                  {activePipeline.nodes.map((node, index) => (
                    <React.Fragment key={node.id}>
                      <div
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn("p-4 rounded-2xl border transition-all text-center flex flex-col justify-between min-h-[110px] cursor-pointer group",
                          selectedNodeId === node.id ? "bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500/20" : "bg-slate-950 border-slate-900 hover:border-slate-800"
                        )}
                      >
                        <div>
                          <span className={cn("text-[7px] font-black uppercase px-2 py-0.5 rounded font-mono",
                            node.type === "trigger" ? "bg-emerald-500/10 text-emerald-400" :
                            node.type === "agent" ? "bg-amber-500/10 text-amber-400" :
                            node.type === "model" ? "bg-indigo-500/10 text-indigo-400" :
                            node.type === "db" ? "bg-cyan-500/10 text-cyan-400" : "bg-rose-500/10 text-rose-400"
                          )}>
                            {node.type}
                          </span>
                          <span className="text-[11px] font-bold text-white block mt-2 leading-tight group-hover:text-indigo-400 transition-colors">
                            {node.label}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-500 font-mono mt-2 block">ID: {node.id}</span>
                      </div>

                      {/* Connection arrow */}
                      {index < activePipeline.nodes.length - 1 && (
                        <div className="hidden md:flex items-center justify-center text-slate-700 font-bold">
                          ➔
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="mt-6 flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-900/60 pt-4">
                  <span>💡 Tip: Click any node block to inspect microservice parameters and execution keys in the sidebar.</span>
                  <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                    Nodes Count: {activePipeline.nodes.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Node Properties & Sandbox Tester sidebar */}
            <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="border-b border-slate-900 pb-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Properties Inspector</span>
                  <h4 className="text-sm font-black text-white">{activeNode.label}</h4>
                  <p className="text-[10px] text-slate-500">Pipeline Module Type: {activeNode.type.toUpperCase()}</p>
                </div>

                {/* Properties list */}
                <div className="bg-slate-950/80 p-4 border border-slate-900 rounded-2xl space-y-2 text-xs">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Active Node State</span>
                  {Object.entries(activeNode.config).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-slate-400 font-mono text-[10px]">{key}:</span>
                      <span className="font-bold text-slate-200 font-mono">{val.toString()}</span>
                    </div>
                  ))}
                </div>

                {/* Pipeline Testing Log */}
                <div className="flex-1 flex flex-col space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Flow Validation Console</span>
                  <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-[10px] text-slate-400 overflow-y-auto max-h-[180px] space-y-1 select-text">
                    {pipelineTestLogs.length === 0 ? (
                      <div className="text-slate-600 italic">Click "Trigger Visual Sandbox Test" below to verify data pipelines flows.</div>
                    ) : (
                      pipelineTestLogs.map((log, idx) => (
                        <div key={idx} className={cn(
                          log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" :
                          log.includes("[NODE:") ? "text-indigo-400" : "text-slate-400"
                        )}>
                          {log}
                        </div>
                      ))
                    )}
                    {isTestingPipeline && (
                      <div className="text-indigo-400 animate-pulse">Running automation simulation...</div>
                    )}
                  </div>
                </div>

                {pipelineCompleted && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-2 text-xs">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-300 leading-normal">
                      <span className="font-bold text-emerald-400">Ledger Confirmed:</span> Automated screening loop parsed and indexed matching resume without SLA leakage.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-900/60 flex gap-2 shrink-0">
                <button
                  onClick={handleRunPipelineTest}
                  disabled={isTestingPipeline}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Zap size={13} /> Trigger Visual Sandbox Test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            OPENHANDS WORKSPACE (Sprint 9)
            ==================================================================== */}
        {activeTab === "openhands" && (
          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            
            {/* Tasks ledger & repository tree */}
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center pb-2">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">AI Software Engineer Ledger</span>
                <span className="text-[10px] text-slate-500">Continuous integration & autonomous coding loops</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[500px] pr-1">
                {codingTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setActiveTaskId(t.id)}
                    className={cn("p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer",
                      activeTaskId === t.id ? "bg-indigo-600/5 border-indigo-500" : "bg-[#070A13] border-slate-900 hover:border-slate-800"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-black text-white block leading-snug">{t.title}</span>
                        <span className="text-[10px] text-indigo-400 font-mono mt-1.5 block">{t.affectedFile}</span>
                      </div>
                      <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border flex items-center gap-1",
                        t.status === "VERIFIED" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        t.status === "RUNNING" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse" :
                        "bg-slate-500/10 border-slate-500/20 text-slate-400"
                      )}>
                        {t.status}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-3 leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-900">
                      <span className="font-bold text-slate-500">Instruction:</span> {t.instruction}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Code executor workspace terminal */}
            <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="border-b border-slate-900 pb-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Agent Workspace Shell</span>
                  <h4 className="text-sm font-black text-white">{activeCodingTask.title}</h4>
                  <p className="text-[10px] text-slate-500">Active Working File: {activeCodingTask.affectedFile}</p>
                </div>

                {/* Simulated build and execution progress */}
                <div className="flex-1 flex flex-col space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">OpenHands AST Code Compiler</span>
                  <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-[10px] text-slate-400 overflow-y-auto max-h-[220px] space-y-1.5 select-text">
                    {activeCodingTask.progress.length === 0 ? (
                      <div className="text-slate-600 italic">Task queue is pending. Dispatch AI Engineer to start compiler checks.</div>
                    ) : (
                      activeCodingTask.progress.map((log, idx) => (
                        <div key={idx} className={cn(
                          log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" :
                          log.includes("[WARN]") ? "text-amber-400" : "text-slate-400"
                        )}>
                          {log}
                        </div>
                      ))
                    )}
                    {isDispatching && activeCodingTask.id === activeTaskId && (
                      <div className="text-indigo-400 animate-pulse">Analyzing compiler feedback...</div>
                    )}
                  </div>
                </div>

                {/* Prompt generator bar */}
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Write custom coding prompt</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dispatchPrompt}
                      onChange={(e) => setDispatchPrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleDispatchCodingTask(); }}
                      disabled={isDispatching}
                      placeholder="e.g., Rewrite ABAC rule to whitelist Admin role..."
                      className="flex-1 bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500/40 outline-none"
                    />
                    <button
                      onClick={handleDispatchCodingTask}
                      disabled={isDispatching || !dispatchPrompt.trim()}
                      className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Plus size={13} /> Dispatch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            CRAWL4AI WORKSPACE (Sprint 10)
            ==================================================================== */}
        {activeTab === "crawl" && (
          <div className="flex-1 flex flex-col xl:flex-row gap-6">
            
            {/* Ingestion & crawler options */}
            <div className="flex-1 space-y-4 flex flex-col">
              <div className="flex justify-between items-center pb-2 shrink-0">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">Crawl4AI Web Ingestor</span>
                  <span className="text-[10px] text-slate-500">Power RAG, Knowledge Graph embeddings, and Deep semantic crawlers</span>
                </div>
              </div>

              {/* Crawl URL prompt bar */}
              <div className="p-4 bg-[#070A13] border border-slate-900 rounded-2xl flex flex-col sm:flex-row gap-3 shrink-0">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Source Ingestion URL</label>
                  <input
                    type="url"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/jobs/react-engineer"
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500/40"
                  />
                </div>
                <button
                  onClick={handleStartCrawl}
                  disabled={isCrawling || !crawlUrl.trim()}
                  className="sm:self-end px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  <Search size={13} /> Ingest & Vectorize
                </button>
              </div>

              {/* Live Crawler Ingestion output logs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                
                {/* Cleaned markdown view */}
                <div className="bg-[#070A13] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between min-h-[250px]">
                  <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Cleaned Markdown Extraction</span>
                    <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-[10px] text-slate-400 overflow-y-auto max-h-[200px] whitespace-pre-wrap select-text leading-relaxed">
                      {crawledContent ? crawledContent : (
                        <span className="text-slate-600 italic">Awaiting web crawler ingestion. Raw pages are cleaned of HTML noise, scripts, and layout elements automatically.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Crawl logs view */}
                <div className="bg-[#070A13] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between min-h-[250px]">
                  <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Scraper Browser Console Logs</span>
                    <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl p-4 font-mono text-[10px] text-slate-400 overflow-y-auto max-h-[200px] space-y-1.5 select-text">
                      {crawlLogs.length === 0 ? (
                        <span className="text-slate-600 italic">No active scraping jobs running.</span>
                      ) : (
                        crawlLogs.map((log, idx) => (
                          <div key={idx} className={cn(
                            log.includes("[SUCCESS]") ? "text-emerald-400 font-bold" :
                            log.includes("[CRAWLING]") ? "text-amber-400" : "text-slate-400"
                          )}>
                            {log}
                          </div>
                        ))
                      )}
                      {isCrawling && (
                        <div className="text-indigo-400 animate-pulse">Scraping web indexes...</div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Knowledge Graph visualization / Entity Relationships list */}
            <div className="w-full xl:w-[450px] bg-[#070A13] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="border-b border-slate-900 pb-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Semantic Graph Engine</span>
                  <h4 className="text-sm font-black text-white">Enterprise Knowledge Graph</h4>
                  <p className="text-[10px] text-slate-500">Live relationship maps fetched via Crawl4AI RAG</p>
                </div>

                {/* Entities grid */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[280px] pr-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Extracted Node Relationships</span>
                  <div className="grid grid-cols-2 gap-2">
                    {knowledgeEntities.map((ent) => (
                      <div key={ent.id} className="p-3 bg-slate-950 border border-slate-900 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{ent.label}</span>
                          <span className={cn("text-[7px] font-bold px-1 py-0.2 rounded uppercase tracking-wide",
                            ent.type === "ORGANIZATION" ? "bg-indigo-500/15 text-indigo-400" :
                            ent.type === "JOB_ROLE" ? "bg-amber-500/15 text-amber-400" :
                            ent.type === "SKILL" ? "bg-emerald-500/15 text-emerald-400" :
                            "bg-cyan-500/15 text-cyan-400"
                          )}>
                            {ent.type.slice(0, 4)}
                          </span>
                        </div>
                        <div className="text-[8px] text-slate-500 truncate">
                          ➔ {ent.connections.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add dynamic entity */}
                <form onSubmit={handleAddKnowledgeEntity} className="pt-3 border-t border-slate-900/60 space-y-2">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Inject Custom Graph Node</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      value={newEntityLabel}
                      onChange={(e) => setNewEntityLabel(e.target.value)}
                      placeholder="e.g. Docker, TechCorp"
                      className="bg-slate-950 border border-slate-900 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500/40 outline-none"
                    />
                    <select
                      value={newEntityType}
                      onChange={(e) => setNewEntityType(e.target.value as any)}
                      className="bg-slate-950 border border-slate-900 rounded-xl px-2 py-2 text-xs text-slate-300 focus:border-indigo-500/40 outline-none font-bold"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="JOB_ROLE">Job Role</option>
                      <option value="SKILL">Core Skill</option>
                      <option value="METRIC">Target Metric</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={!newEntityLabel.trim()}
                    className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    + Sync Node with Graph
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
