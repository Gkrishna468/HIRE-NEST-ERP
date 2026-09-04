import React, { useState, useEffect, useMemo } from "react";
import {
  Download,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  Briefcase,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatINR } from "../lib/currency";

export interface SubmissionRecord {
  id: string;
  candidateId?: string;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  requirementId?: string;
  requirementTitle?: string;
  title?: string;
  clientId?: string;
  clientName?: string;
  vendorId?: string;
  vendorName?: string;
  status?: string;
  matchScore?: number;
  dealValue?: number;
  financials?: {
    clientBudget?: number;
    vendorPayout?: number;
    adminMargin?: number;
  };
  createdAt?: any;
  updatedAt?: any;
}

interface SubmissionsLedgerExportProps {
  role: "admin" | "recruiter" | "vendor" | "client";
  orgId?: string;
  initialSubmissions?: SubmissionRecord[];
  title?: string;
  subtitle?: string;
}

export const SubmissionsLedgerExport: React.FC<SubmissionsLedgerExportProps> = ({
  role,
  orgId,
  initialSubmissions = [],
  title = "Submission & Deal Pipeline Ledger",
  subtitle = "Complete ecosystem mapping with Excel export and stage filtering",
}) => {
  const [submissions, setSubmissions] =
    useState<SubmissionRecord[]>(initialSubmissions);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<"date" | "matchScore" | "revenue">(
    "date",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Real-time Firestore sync
  useEffect(() => {
    setLoading(true);
    let qRef = collection(db, "submissions");

    const unsubscribe = onSnapshot(
      qRef,
      (snap) => {
        let docs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as SubmissionRecord[];

        // Apply ABAC filtering
        if (role === "vendor" && orgId) {
          docs = docs.filter(
            (s) =>
              s.vendorId === orgId ||
              s.vendorId === "local" ||
              s.vendorName?.toLowerCase().includes(orgId.toLowerCase()),
          );
        } else if (role === "client" && orgId) {
          docs = docs.filter(
            (s) =>
              s.clientId === orgId ||
              s.clientId === "HQ" ||
              s.clientName?.toLowerCase().includes(orgId.toLowerCase()),
          );
        }

        if (docs.length > 0 || initialSubmissions.length === 0) {
          setSubmissions(docs);
        }
        setLoading(false);
      },
      (err) => {
        console.warn("[SubmissionsLedger] Firestore subscription note:", err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [role, orgId]);

  // Status mapping and normalization
  const getNormalizedStatus = (status?: string) => {
    const s = (status || "PENDING_REVIEW").toUpperCase();
    if (s.includes("PLACE") || s.includes("HIRED") || s.includes("OFFER_ACCEPT"))
      return "PLACED";
    if (s.includes("INTERVIEW")) return "INTERVIEWING";
    if (s.includes("SHORTLIST")) return "SHORTLISTED";
    if (s.includes("REJECT")) return "REJECTED";
    if (s.includes("OFFER")) return "OFFER_RELEASED";
    return "SUBMITTED";
  };

  const getStatusBadge = (status?: string) => {
    const norm = getNormalizedStatus(status);
    switch (norm) {
      case "PLACED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Closed / Placed
          </span>
        );
      case "INTERVIEWING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3 text-blue-400" />
            Interviewing
          </span>
        );
      case "SHORTLISTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-3 h-3 text-indigo-400" />
            Shortlisted
          </span>
        );
      case "OFFER_RELEASED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <DollarSign className="w-3 h-3 text-amber-400" />
            Offer Released
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-300 border border-slate-700">
            <Clock className="w-3 h-3 text-slate-400" />
            Submitted
          </span>
        );
    }
  };

  // Filtered & Sorted Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((sub) => {
        const query = searchTerm.toLowerCase();
        const cand = (sub.candidateName || "").toLowerCase();
        const req = (sub.requirementTitle || sub.title || "").toLowerCase();
        const client = (sub.clientName || "").toLowerCase();
        const vendor = (sub.vendorName || "").toLowerCase();
        const matchesSearch =
          cand.includes(query) ||
          req.includes(query) ||
          client.includes(query) ||
          vendor.includes(query);

        if (!matchesSearch) return false;

        if (statusFilter === "ALL") return true;
        return getNormalizedStatus(sub.status) === statusFilter;
      })
      .sort((a, b) => {
        if (sortField === "matchScore") {
          const scoreA = a.matchScore || 0;
          const scoreB = b.matchScore || 0;
          return sortDirection === "asc" ? scoreA - scoreB : scoreB - scoreA;
        }
        if (sortField === "revenue") {
          const revA =
            a.dealValue || a.financials?.clientBudget || 15000;
          const revB =
            b.dealValue || b.financials?.clientBudget || 15000;
          return sortDirection === "asc" ? revA - revB : revB - revA;
        }
        // Date sort
        const timeA =
          new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0).getTime() || 0;
        const timeB =
          new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0).getTime() || 0;
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      });
  }, [submissions, searchTerm, statusFilter, sortField, sortDirection]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    let placed = 0;
    let interviewing = 0;
    let shortlisted = 0;
    let confirmedRev = 0;
    let pipelineRev = 0;

    submissions.forEach((s) => {
      const norm = getNormalizedStatus(s.status);
      const val = Number(s.dealValue || s.financials?.clientBudget || 15000);

      if (norm === "PLACED") {
        placed++;
        confirmedRev += val;
      } else if (norm === "INTERVIEWING" || norm === "OFFER_RELEASED") {
        interviewing++;
        pipelineRev += val;
      } else if (norm === "SHORTLISTED" || norm === "SUBMITTED") {
        shortlisted++;
        pipelineRev += val * 0.4; // Weighted pipeline
      }
    });

    return {
      total: submissions.length,
      placed,
      interviewing,
      shortlisted,
      confirmedRev,
      pipelineRev: Math.round(pipelineRev),
    };
  }, [submissions]);

  // Excel (CSV) Export
  const handleExportExcel = () => {
    const headers = [
      "Submission ID",
      "Candidate Name",
      "Candidate Email",
      "Candidate Phone",
      "Requirement Title",
      "Requirement ID",
      "Client Name",
      "Vendor Partner",
      "Status / Stage",
      "Match Score (%)",
      "Deal Value / Fee (₹ INR)",
      "Created Date",
    ];

    const rows = filteredSubmissions.map((s) => {
      const dateStr = s.createdAt
        ? new Date(
            s.createdAt?.seconds ? s.createdAt.seconds * 1000 : s.createdAt,
          ).toLocaleDateString()
        : "N/A";
      const val = s.dealValue || s.financials?.clientBudget || 150000;

      return [
        `"${(s.id || "").replace(/"/g, '""')}"`,
        `"${(s.candidateName || "Candidate").replace(/"/g, '""')}"`,
        `"${(s.candidateEmail || "").replace(/"/g, '""')}"`,
        `"${(s.candidatePhone || "").replace(/"/g, '""')}"`,
        `"${(s.requirementTitle || s.title || "Role").replace(/"/g, '""')}"`,
        `"${(s.requirementId || "").replace(/"/g, '""')}"`,
        `"${(s.clientName || "Enterprise Client").replace(/"/g, '""')}"`,
        `"${(s.vendorName || "HireNest Partner").replace(/"/g, '""')}"`,
        `"${getNormalizedStatus(s.status)}"`,
        s.matchScore || 85,
        val,
        `"${dateStr}"`,
      ].join(",");
    });

    // Add UTF-8 BOM so Excel opens it with perfect character encoding
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `HireNestOS_Submissions_${role.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            {title}
          </h2>
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-emerald-900/30 active:scale-95"
            title="Export mapped submissions to Excel / CSV"
          >
            <Download className="w-4 h-4" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
          <div className="text-xs font-medium text-slate-400">Total Submissions</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">
            {stats.total}
          </div>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3">
          <div className="text-xs font-medium text-emerald-400">
            Closed / Placed
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">
            {stats.placed}
          </div>
        </div>
        <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-3">
          <div className="text-xs font-medium text-blue-400">Active Pipeline</div>
          <div className="text-2xl font-bold text-blue-300 mt-1">
            {stats.interviewing + stats.shortlisted}
          </div>
        </div>
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3">
          <div className="text-xs font-medium text-amber-400">
            Confirmed Revenue
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-1">
            {formatINR(stats.confirmedRev)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate, role, client, or vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Stage:
          </span>
          {[
            { id: "ALL", label: "All" },
            { id: "SUBMITTED", label: "Submitted" },
            { id: "SHORTLISTED", label: "Shortlisted" },
            { id: "INTERVIEWING", label: "Interviewing" },
            { id: "PLACED", label: "Placed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Candidate</th>
              <th className="py-3 px-4">Requirement</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Vendor Partner</th>
              <th className="py-3 px-4">Match</th>
              <th className="py-3 px-4">Stage / Status</th>
              <th className="py-3 px-4 text-right">Est. Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredSubmissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-8 h-8 text-slate-600" />
                    <span>No submissions matching criteria found</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSubmissions.map((sub) => {
                const reqTitle =
                  sub.requirementTitle || sub.title || "Software Engineer";
                const clientName = sub.clientName || "Enterprise Client";
                const vendorName = sub.vendorName || "HireNest Partner";
                const val =
                  sub.dealValue || sub.financials?.clientBudget || 150000;

                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">
                        {sub.candidateName || "Candidate"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {sub.candidateEmail || "Verified in pool"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-300 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate max-w-[200px]" title={reqTitle}>
                          {reqTitle}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[140px]" title={clientName}>
                          {clientName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {vendorName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${sub.matchScore || 85}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-indigo-300">
                          {sub.matchScore || 85}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(sub.status)}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-200">
                      {formatINR(val)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubmissionsLedgerExport;
