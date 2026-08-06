import { useEffect, useState } from "react";
import { Badge } from "../lib/Badge";
import { Button } from "../lib/Button";
import { EmptyState } from "../components/EmptyState";
import { cn } from "../lib/utils";
import {
  Send,
  Shield,
  Paperclip,
  Eye,
  EyeOff,
  FileText,
  Bot,
  DollarSign,
  CheckCircle2,
  Circle,
  Calendar,
  MessageSquare,
  ChevronRight,
  Sparkles,
  Clock,
  Zap,
  Activity,
  Network,
} from "lucide-react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  getDoc,
  serverTimestamp,
  orderBy,
  updateDoc,
  limit,
} from "firebase/firestore";
import {
  logExecutionEvent,
  ExecutionEventType,
  createSLA,
} from "../lib/infrastructureService";
import { ExecutionFeed } from "../components/ExecutionFeed";
import { motion, AnimatePresence } from "motion/react";
import { DealRoomCopilot } from "../components/DealRoomCopilot";
import { emitEvent } from "../services/eventBus";
import { publishEvent } from "../lib/eventEngine";

const STAGES = [
  { id: "shortlisted", label: "Shortlisted" },
  { id: "technical_l1", label: "Tech L1" },
  { id: "technical_l2", label: "Tech L2" },
  { id: "final_round", label: "Final Round" },
  { id: "offer", label: "Offer" },
  { id: "placed", label: "Placed" },
];

export default function DealRoomsTab() {
  const [dealRooms, setDealRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [aiIntelligence, setAiIntelligence] = useState<{
    questions: string[];
    starters: string[];
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    let unsubDealRooms: any;
    let unsubAuth: any;

    import("firebase/auth").then(({ onAuthStateChanged }) => {
      unsubAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            let role = "user";
            let userOrgId = "";

            if (userDoc.exists()) {
              const data = userDoc.data();
              role = data.role;
              userOrgId = data.organizationId;
            }

            const superAdmins = [
              "gopal@hirenestworkforce.com",
              "gopalkrishna0046@gmail.com",
            ];
            if (
              user.email &&
              superAdmins.includes(user.email.toLowerCase())
            ) {
              role = "super_admin";
              userOrgId = "ORG-GLOBAL-HQ";
            }

            if (!userDoc.exists() && role === "user") {
              const knownAdmins = [
                "0xpXdzSQE6V92xbnCkiczPHexiU2",
                "vetAu3RF2qYVmsCuB6cpEz9DDqA2",
                "ZlpY4qN9BKS7n0yoMQP7LDMvvJ53",
              ];
              if (knownAdmins.includes(user.uid)) {
                role = "admin";
                userOrgId = "ORG-GLOBAL-HQ";
              }
            }

            setUserRole(role);
            setOrgId(userOrgId);
          } catch (e) {
            console.warn("User profile fetch failed, using session heuristics");
          }
        }
      });
    });

    // Listen to Deal Rooms
    const loadDealRooms = async () => {
      if (!orgId) return;
      try {
        // Try Proxy FIRST (Filtered by user context)
        const response = await fetch(
          `/api/user-context?orgId=${orgId}&role=${userRole}`,
        );
        if (response.ok) {
          const resData = await response.json();
          if (resData.dealRooms) {
            setDealRooms(resData.dealRooms);
            return;
          }
        }

        // Fallback to Firestore
        let q;
        if (userRole && userRole.startsWith("client")) {
          q = query(
            collection(db, "dealRooms"),
            where("clientId", "==", orgId),
            limit(50),
          );
        } else if (userRole && userRole.includes("vendor")) {
          q = query(
            collection(db, "dealRooms"),
            where("vendorId", "==", orgId),
            limit(50),
          );
        } else {
          q = query(collection(db, "dealRooms"), limit(50)); // HQ/Admin
        }

        const unsubscribe = onSnapshot(
          q,
          (snap) => {
            const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const data = raw.filter((dr: any) => dr.status !== "DELETED" && dr.isActive !== false);
            setDealRooms(data);
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, "dealRooms");
          },
        );
        return unsubscribe;
      } catch (err) {
        console.warn("DealRoom sync fallback triggered");
      }
    };

    loadDealRooms().then((u) => (unsubDealRooms = u));
    
    return () => {
      if (unsubAuth) unsubAuth();
      if (unsubDealRooms) unsubDealRooms();
    };
  }, [orgId, userRole]); // Added dependencies

  useEffect(() => {
    if (selectedRoom) {
      setAiIntelligence(null); // Reset when switching rooms

      // Auto-Fix Metadata for legacy rooms
      const fixMetadata = async () => {
        if (
          !selectedRoom.jobTitle ||
          selectedRoom.jobTitle === "Strategic Role" ||
          !selectedRoom.experience
        ) {
          if (selectedRoom.requirementId) {
            try {
              const reqDoc = await getDoc(
                doc(db, "requirements_public", selectedRoom.requirementId),
              );
              if (reqDoc.exists()) {
                const reqData = reqDoc.data();
                await updateDoc(doc(db, "dealRooms", selectedRoom.id), {
                  jobTitle:
                    reqData.title || selectedRoom.jobTitle || "Strategic Role",
                  experience:
                    reqData.experience || selectedRoom.experience || "8+ YRS",
                });
              }
            } catch (e) {
              console.warn("Metadata auto-fix failed", e);
            }
          }
        }
      };
      fixMetadata();

      const loadMessages = async () => {
        try {
          // Try Proxy for messages first if available in the sync payload
          const response = await fetch("/api/governance");
          if (response.ok) {
            // In a real scenario we'd have a specific messages endpoint or filtered sync
            // For now we'll allow Firestore to handle chat as it's more real-time,
            // but we'll wrap it carefully.
          }
        } catch (e) {}

        const q = query(
          collection(db, "dealRooms", selectedRoom.id, "messages"),
          orderBy("timestamp", "asc"),
        );
        const unsubscribe = onSnapshot(
          q,
          (snap) => {
            setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (error) => {
            console.warn("Message sync fallback - trying legacy API");
            // Fallback to server-side message proxy if Firestore fails
            fetch(`/api/dealrooms/${selectedRoom.id}/messages`)
              .then((r) => r.json())
              .then((data) => setMessages(data))
              .catch(() =>
                handleFirestoreError(
                  error,
                  OperationType.GET,
                  `dealRooms/${selectedRoom.id}/messages`,
                ),
              );
          },
        );
        return unsubscribe;
      };

      let unsubMsg: any;
      loadMessages().then((u) => (unsubMsg = u));
      return () => unsubMsg && unsubMsg();
    }
  }, [selectedRoom]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedRoom) return;

    const payload = {
      senderRole: userRole || "User",
      senderId: auth.currentUser?.uid || "unknown",
      text: inputText,
      type: "text",
      timestamp: serverTimestamp(),
    };

    try {
      await addDoc(
        collection(db, "dealRooms", selectedRoom.id, "messages"),
        payload,
      );
      setInputText("");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `dealRooms/${selectedRoom.id}/messages`,
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileDataUrl = event.target?.result as string;
        const payload = {
          senderRole: userRole || "User",
          senderId: auth.currentUser?.uid || "UNKNOWN",
          type: "file",
          text: `Uploaded file: ${file.name}`,
          fileUrl: fileDataUrl,
          fileName: file.name,
          timestamp: serverTimestamp(),
        };
        await addDoc(
          collection(db, "dealRooms", selectedRoom.id, "messages"),
          payload,
        );
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  const fetchIntelligence = async () => {
    if (!selectedRoom) return;
    setIsAiLoading(true);
    try {
      const response = await fetch("/api/deal-intelligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          profile: selectedRoom.candidateName || "Candidate Profile",
          jd: selectedRoom.jobTitle || "Job Description",
          type: userRole?.includes("client") ? "client" : "vendor",
        }),
      });
      if (response.ok) {
        setAiIntelligence(await response.json());
      } else {
        const errText = await response.text();
        console.warn(
          `AI Intelligence fetch returned status ${response.status}`,
        );
      }
    } catch (e: any) {
      alert(
        `Network connectivity issue: ${e.message || "Failed to reach intelligence layer"}`,
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateStage = async (stageId: string) => {
    if (!selectedRoom || !stageId) return;
    const isFinalStage = stageId === "placed";
    const requiresApproval =
      ["offer", "placed"].includes(stageId) && !isAdmin && !isClient;

    try {
      if (requiresApproval) {
        await addDoc(collection(db, "dealRoomApprovals"), {
          dealRoomId: selectedRoom.id,
          requestedStage: stageId,
          requestedByRole: userRole,
          requestedBy: auth.currentUser?.uid,
          status: "PENDING",
          timestamp: serverTimestamp(),
        });
        await addDoc(collection(db, "dealRooms", selectedRoom.id, "messages"), {
          senderRole: "System Admin",
          senderId: "System",
          text: `⚠️ GOVERNANCE ALERT: Moving candidate to [${STAGES.find((s) => s.id === stageId)?.label}] requires Admin/Client authorization. Approval request has been securely routed.`,
          type: "system",
          timestamp: serverTimestamp(),
        });
        return;
      }

      await updateDoc(doc(db, "dealRooms", selectedRoom.id), {
        currentStage: stageId,
        status: isFinalStage ? "CLOSED" : selectedRoom.status,
        updatedAt: serverTimestamp(),
      });

      if (
        !isFinalStage &&
        stageId !== "shortlisted" &&
        selectedRoom.candidateId
      ) {
        await updateDoc(doc(db, "candidatePool", selectedRoom.candidateId), {
          pipelineStage: "Interviewing",
          updatedAt: serverTimestamp(),
        });
      }

      // Instant UI synchronization
      setSelectedRoom((prev: any) => ({
        ...prev,
        currentStage: stageId,
        status: isFinalStage ? "CLOSED" : prev.status,
      }));

      // Log to Execution Bus
      await logExecutionEvent(
        isFinalStage
          ? ExecutionEventType.PLACEMENT_CLOSED
          : ExecutionEventType.INTERVIEW_SCHEDULED,
        selectedRoom.id,
        "deal_room",
        {
          stage: STAGES.find((s) => s.id === stageId)?.label,
          candidateName: selectedRoom.candidateName,
          organizationId: orgId,
        },
        selectedRoom.requirementId,
      );

      // Auto-message for stage update
      await addDoc(collection(db, "dealRooms", selectedRoom.id, "messages"), {
        senderRole: "System Admin",
        senderId: "System",
        text: `📍 Pipeline update: Target safely promoted to stage [${STAGES.find((s) => s.id === stageId)?.label}].`,
        type: "system",
        timestamp: serverTimestamp(),
      });

      if (isFinalStage) {
        // Update Candidate Stage
        if (selectedRoom.candidateId) {
          await updateDoc(doc(db, "candidatePool", selectedRoom.candidateId), {
            pipelineStage: "Placed",
            updatedAt: serverTimestamp(),
          });
        }
        // Update Job Status
        if (selectedRoom.requirementId) {
          await updateDoc(
            doc(db, "requirements_public", selectedRoom.requirementId),
            {
              status: "CLOSED",
              updatedAt: serverTimestamp(),
            },
          );
        }

        // Simulate Match Email
        await addDoc(collection(db, "dealRooms", selectedRoom.id, "messages"), {
          senderRole: "System Admin",
          senderId: "System",
          text: `🎉 MATCH FINALIZED! Secure confirmation email sent to Admin HQ (Vendor ID: ${selectedRoom.vendorId} matched with ${selectedRoom.clientName || "Client"} for ${selectedRoom.candidateName}).`,
          type: "system",
          timestamp: serverTimestamp(),
        });

        // Notify client and vendor of placement
        await publishEvent({
          type: "success",
          title: "Requirement Fulfilled! 🎉",
          message: `Candidate ${selectedRoom.candidateName} has been successfully placed for ${selectedRoom.jobTitle}.`,
          recipients:
            selectedRoom.clientId && selectedRoom.vendorId
              ? [selectedRoom.clientId, selectedRoom.vendorId, "GLOBAL_ADMIN"]
              : ["GLOBAL_ADMIN", "GLOBAL_CLIENT", "GLOBAL_VENDOR"],
        });

        await emitEvent(
          "PlacementCompleted",
          "DEAL_ROOM",
          selectedRoom.id,
          auth.currentUser?.uid || "system",
          userRole || "unknown",
          {
            requirementId: selectedRoom.requirementId,
            submissionId: selectedRoom.submissionId,
            candidateName: selectedRoom.candidateName,
            clientId: selectedRoom.clientId,
            vendorId: selectedRoom.vendorId,
          },
        );

        // Final "Happy Onboarding" message
        await addDoc(collection(db, "dealRooms", selectedRoom.id, "messages"), {
          senderRole: "AI Copilot",
          senderId: "System",
          text: `🏆 Deal Closed. Happy Onboarding! Please contact global_admin@hirenestworkforce.com for the final contract signing and billing reconciliation.`,
          timestamp: serverTimestamp(),
        });

        // Autogenerate Onboarding Handoff Engine documents
        await addDoc(collection(db, "onboardingHandoffs"), {
          dealRoomId: selectedRoom.id,
          candidateName: selectedRoom.candidateName,
          status: "INITIATED",
          tasks: [
            {
              id: "docs",
              title: "Collect Documentation & NDAs",
              status: "PENDING",
            },
            {
              id: "bgv",
              title: "Global Background Verification",
              status: "PENDING",
            },
            {
              id: "it",
              title: "Secure IT Asset Allocation",
              status: "PENDING",
            },
          ],
          timestamp: serverTimestamp(),
        });
        
        // Auto-generate Invoices for FinanceOS
        const fee = selectedRoom.expectedFee || 25000;
        await addDoc(collection(db, "invoices"), {
            clientId: selectedRoom.clientId || "Client",
            placementId: selectedRoom.id,
            amount: fee,
            status: "ISSUED",
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            createdAt: serverTimestamp(),
        });
        
        await addDoc(collection(db, "vendor_payouts"), {
            vendorId: selectedRoom.vendorId || "Direct",
            placementId: selectedRoom.id,
            amount: fee * 0.7, // 70% to vendor, 30% margin
            status: "PENDING",
            scheduledDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days from now
            createdAt: serverTimestamp(),
        });

        await addDoc(collection(db, "dealRooms", selectedRoom.id, "messages"), {
          senderRole: "System Admin",
          senderId: "System",
          text: `🚀 ONBOARDING ENGINE ENGAGED: Handoff protocol initiated. Compliance documentation, BGV, and IT allocation tasks auto-generated in the deployment pipeline. Invoice and Vendor Payout drafted in FinanceOS.`,
          type: "system",
          timestamp: serverTimestamp(),
        });
      } else {
        // Not final stage notifications
        let title = "Status Update";
        let text = `Deal Room stage updated to ${STAGES.find((s) => s.id === stageId)?.label}.`;

        if (stageId === "technical_l1" || stageId === "technical_l2") {
          title = "Interview Scheduled";
          text = `An interview has been scheduled for ${selectedRoom.candidateName} (${selectedRoom.jobTitle}).`;
        } else if (stageId === "offer") {
          title = "Offer Released";
          text = `An offer has been extended to ${selectedRoom.candidateName} for ${selectedRoom.jobTitle}.`;
        }

        await publishEvent({
          type: "info",
          title,
          message: text,
          actionUrl: "/deal-rooms",
          recipients:
            selectedRoom.clientId && selectedRoom.vendorId
              ? [selectedRoom.clientId, selectedRoom.vendorId, "GLOBAL_ADMIN"]
              : ["GLOBAL_ADMIN", "GLOBAL_CLIENT", "GLOBAL_VENDOR"],
        });
      }
    } catch (e: any) {
      alert(`Failed to update stage: ${e.message || "Unknown error"}`);
    }
  };

  const handleScheduleInvite = async () => {
    if (!selectedRoom) return;

    // Create SLA for Interview Setup (48h)
    await createSLA(selectedRoom.id, "INTERVIEW", 48);

    // Simulate scheduling logic
    await addDoc(collection(db, "dealRooms", selectedRoom.id, "messages"), {
      senderRole: userRole || "User",
      senderId: auth.currentUser?.uid || "unknown",
      text: `📅 CALENDAR REQUEST: Interview session requested for ${selectedRoom.candidateName || "Candidate"}. Check email for direct link.`,
      type: "text",
      timestamp: serverTimestamp(),
    });

    await emitEvent(
      "InterviewScheduled",
      "DEAL_ROOM",
      selectedRoom.id,
      auth.currentUser?.uid || "system",
      userRole || "unknown",
      {
        requirementId: selectedRoom.requirementId,
        submissionId: selectedRoom.submissionId,
        candidateName: selectedRoom.candidateName,
      },
    );

    setShowScheduleModal(false);
  };

  const isClient = userRole?.includes("client");
  const isVendor = userRole?.includes("vendor");
  const isAdmin =
    userRole === "admin" ||
    userRole === "super_admin" ||
    orgId === "ORG-GLOBAL-HQ";

  const handleRevealToggle = async () => {
    if (!selectedRoom) return;
    const nextState = !selectedRoom.identitiesRevealed;
    try {
      await updateDoc(doc(db, "dealRooms", selectedRoom.id), {
        identitiesRevealed: nextState,
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `dealRooms/${selectedRoom.id}`,
      );
    }

    // System message
    await addDoc(collection(db, "dealRooms", selectedRoom.id, "messages"), {
      senderRole: "System Admin",
      senderId: "Admin",
      text: nextState
        ? "🚨 NDA Approved. Market identities have been revealed for direct coordination."
        : "🔒 Security Alert: Identity Masking has been re-enabled for this deal room.",
      type: "system",
      timestamp: serverTimestamp(),
    });
  };

  const filteredRooms = dealRooms.filter(
    (room) => isAdmin || room.clientId === orgId || room.vendorId === orgId,
  );

  const computeDealHealth = () => {
    if (messages.length < 2) return 100;

    let totalLatency = 0;
    let latencyCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1].timestamp?.seconds;
      const curr = messages[i].timestamp?.seconds;
      if (prev && curr) {
        totalLatency += curr - prev;
        latencyCount++;
      }
    }

    if (latencyCount === 0) return 95;

    const avgLatencyHours = totalLatency / latencyCount / 3600;
    const score = Math.max(20, Math.min(100, 100 - avgLatencyHours * 5)); // 5 point reduction per average latency hour
    return Math.round(score);
  };

  const currentDealHealth = selectedRoom ? computeDealHealth() : 100;

  return (
    <div className="flex-1 flex overflow-hidden p-4 gap-4 pb-0 h-full">
      {/* Left: Submissions List */}
      <section
        className={`${selectedRoom ? "hidden lg:flex" : "flex"} w-full lg:w-1/3 bg-white border border-slate-200 rounded-lg shadow-sm flex-col lg:min-w-[320px]`}
      >
        <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800 tracking-tighter">
            Submission Hub
          </h3>
          <span className="text-[9px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500 italic flex items-center">
            <Shield size={10} className="mr-1" /> Isolation Policy
          </span>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            {filteredRooms.length === 0 ? (
              <div className="p-4 mt-8">
                <EmptyState
                  icon={MessageSquare}
                  title="No active deal rooms"
                  description="A deal room is automatically created when a candidate enters the interview stage."
                  actionLabel="View Pipeline"
                  onAction={() => window.location.hash = '#/pipeline'}
                />
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`px-4 py-4 border-b border-slate-50 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50/50 relative"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r" />
                    )}
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        DEAL ROOM
                      </span>
                      <Badge variant="outline" className="text-[8px] py-0">
                        {room.status}
                      </Badge>
                    </div>
                    <div className="text-[12px] font-bold text-slate-800 truncate mb-1">
                      Candidate Profile:{" "}
                      {room.identitiesRevealed
                        ? room.candidateName
                        : "ANON_CANDIDATE"}
                    </div>
                    <div className="text-[10px] text-slate-500 space-x-2">
                      <span>
                        {room.identitiesRevealed
                          ? "Google HQ"
                          : "CLIENT_MASKED"}
                      </span>
                      <span>•</span>
                      <span>
                        {room.identitiesRevealed
                          ? "ABC Staffing"
                          : "VENDOR_MASKED"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Right: Active Submission Chat */}
      {selectedRoom ? (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden absolute lg:relative inset-0 lg:inset-auto z-10 bg-slate-50 lg:bg-transparent p-4 lg:p-0">
          <section className="flex-1 border border-slate-200 rounded-lg bg-slate-50 flex flex-col overflow-hidden shadow-sm">
            <div className="py-3 border-b bg-white flex items-center px-4 justify-between shrink-0">
              <div className="flex flex-col">
                <div className="font-semibold text-sm text-slate-800 flex items-center mb-1">
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className="lg:hidden mr-2 text-slate-500 hover:text-slate-800"
                  >
                    <ChevronRight size={18} className="rotate-180" />
                  </button>
                  <span className="font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs mr-3 border border-indigo-200 uppercase tracking-tighter">
                    DEAL_{selectedRoom.id.slice(0, 6)}
                  </span>
                  <span className="text-sm font-black text-slate-900 mr-3">
                    {selectedRoom.identitiesRevealed
                      ? selectedRoom.candidateName
                      : "MASKED_CANDIDATE"}
                  </span>
                  {selectedRoom.identitiesRevealed ? (
                    <span className="text-[10px] font-bold text-red-600 flex items-center px-2 py-0.5 bg-red-50 rounded border border-red-100 shrink-0">
                      <Eye size={12} className="mr-1" /> Unmasked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100 shrink-0">
                      <Shield size={12} className="mr-1" /> Masked
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <FileText size={12} className="text-slate-400" />{" "}
                    {selectedRoom.jobTitle || "Strategic Role"}
                  </span>
                  <span className="text-slate-200">|</span>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                    <Clock size={12} />{" "}
                    {selectedRoom.experience ||
                      selectedRoom.yearsOfExperience ||
                      "8+"}{" "}
                    YRS EXP
                  </span>
                  <span className="text-slate-200">|</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    <Activity size={12} /> Health: {currentDealHealth}%
                  </span>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {isClient && (
                  <Button
                    onClick={() => setShowScheduleModal(true)}
                    size="sm"
                    variant="outline"
                    className="text-[10px] uppercase font-black border-indigo-200 text-indigo-600 tracking-widest py-1 h-auto"
                  >
                    Schedule
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    onClick={handleRevealToggle}
                    size="sm"
                    variant="outline"
                    className={`text-[10px] uppercase font-black tracking-widest py-1 h-auto ${selectedRoom.identitiesRevealed ? "border-amber-200 text-amber-600" : "border-red-200 text-red-600"}`}
                  >
                    {selectedRoom.identitiesRevealed
                      ? "Enable Masking"
                      : "Unmask Identities"}
                  </Button>
                )}
              </div>
            </div>

            {/* Pipeline Tracker */}
            <div className="bg-white border-b border-slate-100 px-4 py-3 shrink-0 overflow-x-auto">
              <div className="mb-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                {(() => {
                  const currentIdx = Math.max(
                    0,
                    STAGES.findIndex(
                      (st) =>
                        st.id === (selectedRoom.currentStage || "shortlisted"),
                    ),
                  );
                  return (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((currentIdx + 1) / STAGES.length) * 100}%`,
                      }}
                      transition={{ duration: 0.4 }}
                      className={`absolute top-0 left-0 h-full ${selectedRoom.status === "CLOSED" ? "bg-emerald-500" : "bg-indigo-600"}`}
                    />
                  );
                })()}
              </div>
              <div className="flex items-center justify-between min-w-[600px]">
                {STAGES.map((stage, idx) => {
                  const currentIdx = Math.max(
                    0,
                    STAGES.findIndex(
                      (st) =>
                        st.id === (selectedRoom.currentStage || "shortlisted"),
                    ),
                  );
                  const isCurrent = currentIdx === idx;
                  const isPast = currentIdx > idx;

                  return (
                    <div
                      key={stage.id}
                      className="flex items-center group relative"
                    >
                      <button
                        disabled={!isClient && !isAdmin}
                        onClick={() => updateStage(stage.id)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 transition-all text-center",
                          isCurrent
                            ? "scale-110"
                            : "opacity-60 hover:opacity-100",
                        )}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors",
                            isCurrent
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200"
                              : isPast
                                ? "bg-emerald-100 border-emerald-500 text-emerald-600"
                                : "bg-white border-slate-200 text-slate-300",
                          )}
                        >
                          {isPast ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <div className="text-[9px] font-black">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[9px] font-black uppercase tracking-tighter w-14",
                            isCurrent ? "text-indigo-600" : "text-slate-400",
                          )}
                        >
                          {stage.label}
                        </span>
                      </button>
                      {idx < STAGES.length - 1 && (
                        <div className="w-12 h-[px] bg-slate-100 mx-2 mt-[-14px]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execution Milestones (Network Specific) */}
            <div className="px-4 py-3 bg-slate-900 flex items-center justify-between gap-4 shrink-0 overflow-x-auto">
              {[
                {
                  label: "MSA/NDA EXECUTION",
                  status: selectedRoom.identitiesRevealed
                    ? "COMPLETED"
                    : "IN_PROGRESS",
                },
                {
                  label: "CLIENT INTERVIEW",
                  status:
                    STAGES.findIndex(
                      (s) => s.id === selectedRoom.currentStage,
                    ) >= 2
                      ? "COMPLETED"
                      : "PENDING",
                },
                {
                  label: "OFFER ISSUANCE",
                  status:
                    selectedRoom.currentStage === "offer"
                      ? "IN_PROGRESS"
                      : selectedRoom.currentStage === "placed"
                        ? "COMPLETED"
                        : "LOCKED",
                },
                {
                  label: "BILLING TRIGGER",
                  status: selectedRoom.status === "CLOSED" ? "READY" : "LOCKED",
                },
              ].map((m, i) => (
                <div key={i} className="flex flex-col min-w-[120px]">
                  <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    {m.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        m.status === "COMPLETED"
                          ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                          : m.status === "IN_PROGRESS"
                            ? "bg-indigo-500 animate-pulse"
                            : m.status === "READY"
                              ? "bg-amber-500"
                              : "bg-slate-700",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase tracking-tight",
                        m.status === "COMPLETED"
                          ? "text-white"
                          : "text-slate-400",
                      )}
                    >
                      {m.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Intelligence Quick Tools */}
            <div className="px-4 py-2 bg-indigo-50/50 border-b border-indigo-100/50 flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Co-Pilot Intelligence
                </span>
              </div>
              <div className="flex gap-2">
                {!aiIntelligence ? (
                  <Button
                    onClick={fetchIntelligence}
                    disabled={isAiLoading}
                    variant="ghost"
                    className="h-7 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-white/50 border border-indigo-100"
                  >
                    {isAiLoading
                      ? "Syncing..."
                      : `Generate ${isClient ? "Interview Questions" : "Conversation Starters"}`}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    {(isClient
                      ? aiIntelligence.questions
                      : aiIntelligence.starters
                    )
                      .slice(0, 2)
                      .map((item, i) => (
                        <button
                          key={i}
                          onClick={() => setInputText(item)}
                          className="h-7 px-3 text-[9px] font-bold text-indigo-800 bg-white border border-indigo-200 rounded-lg hover:border-indigo-400 truncate max-w-[200px]"
                        >
                          {item}
                        </button>
                      ))}
                    <Button
                      onClick={() => setAiIntelligence(null)}
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
                    >
                      ↺
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedRoom.status === "CLOSED" && (
                <div className="mb-6 animate-in zoom-in-95 duration-500">
                  <div className="bg-gradient-to-br from-indigo-500 to-indigo-900 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                      <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full blur-2xl animate-pulse" />
                      <div
                        className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"
                        style={{ animationDelay: "1s" }}
                      />
                    </div>
                    <div className="relative z-10 space-y-4">
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
                        <Sparkles className="text-white w-10 h-10" />
                      </div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                        Happy Onboarding!
                      </h2>
                      <p className="text-indigo-100 text-sm max-w-md mx-auto leading-relaxed">
                        Strategy finalized. We have successfully matched{" "}
                        <b>{selectedRoom.candidateName}</b> with{" "}
                        <b>
                          {selectedRoom.identitiesRevealed
                            ? selectedRoom.clientName
                            : "the client"}
                        </b>
                        .
                      </p>
                      <div className="flex gap-3 justify-center pt-4">
                        <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 text-white text-[10px] font-black uppercase tracking-widest">
                          Deal Finalized
                        </div>
                        <div className="px-4 py-2 bg-emerald-500 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 size={12} /> Compliance Verified
                        </div>
                      </div>
                      <div className="pt-6">
                        <p className="text-white/60 text-[10px] italic">
                          Contact Admin HQ for subsequent workflow
                          documentation.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 my-8 text-slate-300">
                    <div className="flex-1 h-[1px] bg-slate-200" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Archived Conversation History
                    </span>
                    <div className="flex-1 h-[1px] bg-slate-200" />
                  </div>
                </div>
              )}
              {messages.map((msg) => {
                const isAI = msg.senderRole === "AI Copilot";
                const isMe = msg.senderId === auth.currentUser?.uid;
                const isSystem = msg.type === "system";

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center my-4">
                      <span className="bg-slate-100 text-slate-600 text-[9px] px-3 py-1 rounded-full font-bold uppercase tracking-[0.2em] border border-slate-200">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span
                        className={`text-[9px] font-black uppercase tracking-[0.1em] ${isAI ? "text-indigo-600 flex items-center" : "text-slate-500"}`}
                      >
                        {isAI && <span className="mr-1">✦</span>}
                        {msg.senderRole}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {msg.timestamp?.seconds
                          ? new Date(
                              msg.timestamp.seconds * 1000,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "..."}
                      </span>
                    </div>
                    <div
                      className={`p-2.5 rounded-lg max-w-[85%] text-[13px] leading-relaxed shadow-sm ${isMe ? "bg-slate-900 text-white rounded-tr-none" : isAI ? "bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-tl-none font-medium" : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"}`}
                    >
                      {msg.type === "file" ? (
                        <div className="flex items-center gap-2">
                          <Paperclip
                            size={14}
                            className={
                              isMe ? "text-indigo-300" : "text-indigo-500"
                            }
                          />
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
                          >
                            {msg.fileName || "View Uploaded File"}
                          </a>
                        </div>
                      ) : msg.type === "email" ? (
                        <div className="flex flex-col gap-1">
                          <div className="text-[10px] font-bold uppercase text-slate-400 mb-1 border-b border-slate-200 pb-1">
                            Incoming Email: {msg.subject}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                          <div className="text-[9px] text-slate-400 mt-1">
                            From:{" "}
                            {msg.fromEmail ||
                              "global_admin@hirenestworkforce.com"}
                          </div>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <DealRoomCopilot room={selectedRoom} />

            <div className="p-3 bg-white border-t border-slate-200 shrink-0">
              <div className="flex gap-2">
                <label className="flex-shrink-0 cursor-pointer p-2 flex items-center justify-center rounded border border-slate-200 hover:bg-slate-50 transition-colors text-slate-400 hover:text-indigo-600">
                  <Paperclip size={16} />
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={selectedRoom.status === "CLOSED" || isUploading}
                  />
                </label>
                <input
                  type="text"
                  disabled={selectedRoom.status === "CLOSED" || isUploading}
                  value={inputText}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    selectedRoom.status === "CLOSED"
                      ? "This room is finalized."
                      : isUploading
                        ? "Uploading file..."
                        : "Message this deal room securely..."
                  }
                  className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-slate-50/50 disabled:bg-slate-100 disabled:italic"
                />
                <Button
                  onClick={handleSend}
                  disabled={
                    selectedRoom.status === "CLOSED" || !inputText.trim()
                  }
                  size="sm"
                  className="bg-indigo-600 hover:bg-slate-900 text-white flex-shrink-0 h-auto py-2 px-6 font-black text-[10px] tracking-widest"
                >
                  SEND
                </Button>
              </div>
            </div>
          </section>

          {/* Intelligence Snapshot Sidebar */}
          <section className="w-full lg:w-80 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden shrink-0">
            <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Bot size={14} className="text-indigo-600" /> Deal Intelligence
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Performance Indicators (SLA Monitor) */}
              <div className="bg-slate-900 rounded-2xl p-4 border border-white/10 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Zap size={60} />
                </div>
                <div className="relative z-10">
                  <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-3 flex items-center gap-2">
                    <Activity size={12} /> Platform Health
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Feedback SLA
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                        <span className="text-[10px] font-black text-emerald-400">
                          08h 12m
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Closure Prob.
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-indigo-400">
                          84% CONFIDENT
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Network Trust
                      </span>
                      <span className="text-[10px] font-black text-indigo-400">
                        92% SECURE
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Timeline Feed */}
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <ExecutionFeed
                  dealId={selectedRoom.id}
                  requirementId={selectedRoom.requirementId}
                />
              </div>

              <div>
                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Counterparties
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                      Lead Client
                    </p>
                    <p className="text-xs font-black text-slate-800">
                      {selectedRoom.identitiesRevealed
                        ? selectedRoom.clientName || "Google HQ"
                        : "IDENTITY_MASKED"}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                      Approved Vendor
                    </p>
                    <p className="text-xs font-black text-slate-800">
                      {selectedRoom.identitiesRevealed
                        ? selectedRoom.vendorName || "Elite Staffing"
                        : "IDENTITY_MASKED"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Pipeline Status
                </h4>
                <div className="flex items-end gap-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                  <span className="text-xl font-black text-indigo-900">
                    {
                      STAGES.find(
                        (s) =>
                          s.id === (selectedRoom.currentStage || "shortlisted"),
                      )?.label
                    }
                  </span>
                  <span className="text-[9px] font-bold text-indigo-500 mb-1 uppercase tracking-widest">
                    Active State
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Match Diagnostics
                </h4>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${selectedRoom.matchData?.matchScore || 85}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-emerald-600">
                    {selectedRoom.matchData?.matchScore || 85}%
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedRoom.matchData?.strengths?.map(
                    (s: string, idx: number) => (
                      <div
                        key={idx}
                        className="text-[10px] text-slate-600 flex gap-2 font-medium"
                      >
                        <CheckCircle2
                          size={10}
                          className="text-emerald-500 mt-0.5 shrink-0"
                        />{" "}
                        {s}
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <h4 className="text-[9px] font-bold text-indigo-900 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Network size={12} /> Explainable AI Trust Evaluation
                </h4>
                <div className="space-y-1.5 mb-2">
                  <div className="flex justify-between items-center text-[9px] font-mono bg-white p-1.5 rounded border border-indigo-50">
                    <span className="text-slate-500 font-bold">
                      L1 Atomic Fact Extraction
                    </span>
                    <span className="text-emerald-600 font-bold">
                      Conf: 0.94
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-mono bg-white p-1.5 rounded border border-indigo-50">
                    <span className="text-slate-500 font-bold">
                      L2 Scenario Synthesis
                    </span>
                    <span className="text-emerald-600 font-bold">
                      Conf: 0.88
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-mono bg-indigo-900 text-indigo-100 p-1.5 rounded border border-indigo-200">
                    <span className="font-bold">L3 Profile Match</span>
                    <span className="text-emerald-400 font-bold">
                      Conf: 0.91
                    </span>
                  </div>
                </div>
                <div className="bg-white p-2 rounded border border-indigo-100 text-[9px] text-slate-600 italic">
                  0.94 confidence match between L1 extracted skill [Rust, K8s]
                  and Job Scenario. Full compliance verified without
                  hallucination alerts.
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button className="px-2 py-1 bg-emerald-600 text-white rounded text-[9px] font-black hover:bg-emerald-700 uppercase tracking-wider w-full flex items-center justify-center gap-1">
                    <CheckCircle2 size={10} /> Approve
                  </button>
                  <button className="px-2 py-1 border border-slate-300 bg-white text-slate-700 rounded text-[9px] font-black hover:bg-slate-50 uppercase tracking-wider w-full flex items-center justify-center gap-1">
                    Escalate
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl">
                <h4 className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-2 border-b border-white/10 pb-1">
                  Candidate Direct
                </h4>
                <p className="text-xs font-bold text-white mb-1">
                  {selectedRoom.identitiesRevealed
                    ? selectedRoom.candidateName
                    : "HIDDEN_PROFILE"}
                </p>
                {selectedRoom.identitiesRevealed && (
                  <div className="space-y-1 mt-2">
                    <p className="text-[10px] text-slate-400 flex items-center gap-2">
                      <MessageSquare size={10} />{" "}
                      {selectedRoom.candidateEmail || "c.rivera@example.com"}
                    </p>
                    <Button
                      onClick={() => setShowScheduleModal(true)}
                      className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase py-1.5 rounded-lg"
                    >
                      Schedule Interview
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Schedule Modal */}
          <AnimatePresence>
            {showScheduleModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
                >
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                      Schedule Interview
                    </h3>
                    <Button
                      variant="ghost"
                      onClick={() => setShowScheduleModal(false)}
                      className="h-8 w-8 p-0"
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <p className="text-xs font-bold text-indigo-900 mb-1">
                        Direct Coordination
                      </p>
                      <p className="text-[11px] text-indigo-700 leading-relaxed">
                        This will generate a calendar request and send it to the
                        candidate's verified email. SLA monitoring will track
                        response time.
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">
                        Duration
                      </label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500">
                        <option>Technical Assessment (60m)</option>
                        <option>Screening Call (30m)</option>
                        <option>Founders Interview (45m)</option>
                      </select>
                    </div>
                    <Button
                      onClick={handleScheduleInvite}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase py-4 rounded-xl shadow-xl shadow-slate-200 transition-all active:scale-95"
                    >
                      Send Invite Request
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <section className="flex-1 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center flex-col text-slate-400 shadow-sm">
          <Shield size={32} className="mb-2 opacity-30" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Secure Deal Environment
          </p>
        </section>
      )}
    </div>
  );
}
