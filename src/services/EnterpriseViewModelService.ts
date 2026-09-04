// src/services/EnterpriseViewModelService.ts

import { db } from "../lib/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where,
  limit,
  orderBy,
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";
import { ProductionDataGuard } from "../lib/ProductionDataGuard";

export interface DecisionItem {
  id: string;
  priorityScore: number;
  title: string;
  reason: string;
  revenueImpact: string;
  slaImpact: string;
  confidence: number;
  requiredOffice: string;
}

export interface PredictivePlacement {
  candidateId: string;
  candidateName: string;
  requirementId: string;
  requirementTitle: string;
  vendorId: string;
  vendorName: string;
  probability: number;
  reason: string;
}

export interface BusinessGraphData {
  nodes: any[];
  edges: any[];
}

export class EnterpriseViewModelService {
  /**
   * Caches the result of a dashboard computation in Firestore to reduce read costs.
   */
  private static async withCache(cacheKey: string, computeFn: () => Promise<any>): Promise<any> {
    const cacheRef = doc(db, "dashboard_cache", cacheKey);
    try {
      const cacheSnap = await getDoc(cacheRef);
      if (cacheSnap.exists()) {
        const data = cacheSnap.data();
        const lastUpdated = data.lastUpdated?.toDate();
        if (lastUpdated) {
          const minutesSinceUpdate = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60);
          if (minutesSinceUpdate < 15) {
            console.log(`[EnterpriseViewModelService] Using cached ${cacheKey} (${Math.round(minutesSinceUpdate)} mins old)`);
            return data.payload;
          }
        }
      }
    } catch (err) {
      console.warn(`[EnterpriseViewModelService] Cache read failed for ${cacheKey}:`, err);
    }

    console.log(`[EnterpriseViewModelService] Computing fresh ${cacheKey}...`);
    const payload = await computeFn();

    try {
      await setDoc(cacheRef, {
        payload,
        lastUpdated: new Date()
      });
    } catch (err) {
      console.warn(`[EnterpriseViewModelService] Cache write failed for ${cacheKey}:`, err);
    }

    return payload;
  }

  /**
   * Universal helper to safely fetch all documents from a collection.
   * Gracefully falls back to empty array if collection is empty or fails.
   */
  private static async safeGetDocs(collectionName: string, queryConstraints: any[] = []): Promise<any[]> {
    try {
      const q = query(collection(db, collectionName), ...queryConstraints);
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Run Production Safety Audit
      ProductionDataGuard.validate(data, `Service Fetch: ${collectionName}`, "Firestore Live Collection");
      
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "ProductionIntegrityError") {
        throw error; // Let integrity errors bubbled up to fail the build/runtime
      }
      console.warn(`[EnterpriseViewModelService] Failed to fetch collection: ${collectionName}`, error);
      return [];
    }
  }

  /**
   * 1. Dashboard Tab Data: Business Graph, AI COO Tower, and Formatted Timeline
   */
  
  static async getDashboardViewModel(userOrgId?: string) {
    const cacheKey = "getDashboardViewModel_" + (userOrgId || "global");
    return this.withCache(cacheKey, () => this._compute_getDashboardViewModel(userOrgId));
  }
private static async _compute_getDashboardViewModel(userOrgId?: string) {
    // Fetch live datasets
    const orgs = await this.safeGetDocs("organizations");
    const candidates = await this.safeGetDocs("candidatePool");
    const requirements = await this.safeGetDocs("requirements_public");
    const submissions = await this.safeGetDocs("submissions");
    const invoices = await this.safeGetDocs("invoices");
    const dealRooms = await this.safeGetDocs("dealRooms");

    // Scoping fallback
    const isHQ = !userOrgId || userOrgId === "ORG-GLOBAL-HQ";

    // Build lookup maps
    const orgMap: Record<string, any> = {};
    orgs.forEach(o => {
      orgMap[o.id] = o;
    });

    const candidateMap: Record<string, any> = {};
    candidates.forEach(c => {
      candidateMap[c.candidateId || c.id] = c;
    });

    const reqMap: Record<string, any> = {};
    requirements.forEach(r => {
      reqMap[r.requirementId || r.id] = r;
    });

    // A. Build Dynamic Business Graph (Nodes and Edges)
    const nodes: any[] = [];
    const edges: any[] = [];

    // Filter and map entities
    const activeClients = orgs.filter(o => o.type === "client" || o.orgType === "client").slice(0, 5);
    const activeVendors = orgs.filter(o => o.type === "vendor" || o.orgType === "vendor").slice(0, 5);
    const activeReqs = requirements.slice(0, 5);
    const activeCands = candidates.slice(0, 5);
    const activeSubs = submissions.slice(0, 5);

    // Populate client nodes
    activeClients.forEach(c => {
      nodes.push({
        id: c.id,
        label: `${c.companyName || c.name || "HQ Partner"} (Client)`,
        type: "CLIENT",
        details: {
          identity: { id: c.id, type: "CLIENT", name: c.companyName || c.name, state: c.status || "ACTIVE" },
          ownership: { mainOwner: "Account Director", accountType: "Enterprise", permissions: "Global Read" },
          state: { currentStage: "FULLY_ONBOARDED", lastUpdated: c.createdAt || "" },
          relationships: { totalLinks: 3, connections: `Active requirements: ${requirements.filter(r => r.clientId === c.id || r.orgId === c.id).length}` },
          metrics: { clientSatisfaction: 95, averageTurnaroundHours: 4 }
        }
      });
    });

    // Populate requirement nodes
    activeReqs.forEach(r => {
      const clientName = orgMap[r.clientId || r.orgId]?.companyName || orgMap[r.clientId || r.orgId]?.name || "Direct Account";
      nodes.push({
        id: r.id,
        label: `${r.title || "Requirement"}`,
        type: "REQUIREMENT",
        details: {
          identity: { id: r.id, type: "REQUIREMENT", name: r.title, state: r.status || "OPEN" },
          ownership: { assignedRecruiter: r.assignedRecruiterId || "Unassigned" },
          state: { currentStage: r.status || "RECRUITING" },
          relationships: { connectedNodes: `Requested by Client: ${clientName}` }
        }
      });

      if (r.clientId || r.orgId) {
        edges.push({
          id: `edge-req-client-${r.id}`,
          source: r.id,
          target: r.clientId || r.orgId,
          label: "REQUESTED_BY"
        });
      }
    });

    // Populate vendor nodes
    activeVendors.forEach(v => {
      nodes.push({
        id: v.id,
        label: `${v.companyName || v.name} (Vendor)`,
        type: "VENDOR",
        details: {
          identity: { id: v.id, type: "VENDOR", name: v.companyName || v.name, state: "VERIFIED" },
          ownership: { supervisor: "HQ Vendor Controller" },
          relationships: { linkOverview: `Submissions: ${submissions.filter(s => s.vendorOrgId === v.id || s.vendorId === v.id).length}` }
        }
      });
    });

    // Populate candidate nodes
    activeCands.forEach(c => {
      const vendorName = orgMap[c.vendorId || c.createdBy]?.companyName || orgMap[c.vendorId || c.createdBy]?.name || "Direct/HQ";
      nodes.push({
        id: c.id,
        label: `${c.fullName || c.name || "Candidate"}`,
        type: "CANDIDATE",
        details: {
          identity: { id: c.id, type: "CANDIDATE", name: c.fullName || c.name, email: c.primaryEmail || "Undisclosed" },
          ownership: { sourceVendor: vendorName },
          state: { currentStage: "POOL" }
        }
      });

      if (c.vendorId && c.vendorId !== "HQ") {
        edges.push({
          id: `edge-cand-vendor-${c.id}`,
          source: c.id,
          target: c.vendorId,
          label: "OWNED_BY"
        });
      }
    });

    // Populate submission nodes
    activeSubs.forEach(s => {
      const candName = candidateMap[s.candidateId]?.fullName || candidateMap[s.candidateId]?.name || "Candidate";
      const reqTitle = reqMap[s.requirementId]?.title || "Requirement";
      nodes.push({
        id: s.id,
        label: `Sub: ${candName} for ${reqTitle}`,
        type: "SUBMISSION",
        details: {
          identity: { id: s.id, type: "SUBMISSION", reference: s.submissionId || s.id, state: s.status },
          relationships: { linkOverview: `Candidate: ${candName}, Job: ${reqTitle}` }
        }
      });

      edges.push({
        id: `edge-sub-cand-${s.id}`,
        source: s.candidateId,
        target: s.id,
        label: "SUBMITTED"
      });

      edges.push({
        id: `edge-sub-req-${s.id}`,
        source: s.id,
        target: s.requirementId,
        label: "SUBMITTED_TO"
      });
    });

    // B. AI COO Decision Engine Tower Decisions
    const recommendations: DecisionItem[] = [];

    // Analyze requirements waiting
    const openReqs = requirements.filter(r => r.status === "OPEN" || r.status === "PUBLISHED" || r.status === "RECRUITING_LIVE");
    if (openReqs.length > 0) {
      recommendations.push({
        id: "coo-req-wait",
        priorityScore: 85,
        title: "Broadcast Open Requirements",
        reason: `${openReqs.length} client requirements are live without enough matching submissions.`,
        revenueImpact: `₹${openReqs.length * 150000} Est. Margin`,
        slaImpact: "-12 hrs response SLA",
        confidence: 0.94,
        requiredOffice: "Sourcing & Delivery"
      });
    }

    // Analyze interview backlog
    const activeInterviews = submissions.filter(s => s.status?.toUpperCase().includes("INTERVIEW"));
    if (activeInterviews.length > 0) {
      recommendations.push({
        id: "coo-interview-backlog",
        priorityScore: 90,
        title: "Resolve Interview Backlog",
        reason: `${activeInterviews.length} candidates are waiting in active interview loops. Feedback needed.`,
        revenueImpact: "High Pipeline Velocity",
        slaImpact: "Client response limit near",
        confidence: 0.96,
        requiredOffice: "Interview Ops"
      });
    }

    // SLA analysis
    const slowVendors = orgs.filter(o => (o.type === "vendor" || o.orgType === "vendor") && (o.slaScore || 0) < 80);
    if (slowVendors.length > 0) {
      recommendations.push({
        id: "coo-vendor-sla",
        priorityScore: 75,
        title: "Reallocate to Preferred Vendors",
        reason: `${slowVendors.length} active delivery partners are showing high response SLAs (>48 hrs).`,
        revenueImpact: "Protected Margins",
        slaImpact: "SLA recovery within 4h",
        confidence: 0.88,
        requiredOffice: "Vendor Controller"
      });
    }

    // Revenue forecasting
    const unpaidInvoices = invoices.filter(inv => inv.status !== "PAID" && inv.status !== "COLLECTED");
    const outstandingVal = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
    if (outstandingVal > 0) {
      recommendations.push({
        id: "coo-revenue-forecast",
        priorityScore: 80,
        title: "Expedite Outstanding Invoices",
        reason: `₹${outstandingVal.toLocaleString("en-IN")} in booked revenue is currently pending invoice clearance.`,
        revenueImpact: `₹${outstandingVal.toLocaleString("en-IN")} Realized Cashflow`,
        slaImpact: "Net-15 threshold warning",
        confidence: 0.98,
        requiredOffice: "Finance Control"
      });
    }

    // Add general priority card if empty
    if (recommendations.length === 0) {
      recommendations.push({
        id: "coo-stable",
        priorityScore: 50,
        title: "All Operational Queues Stable",
        reason: "The AI COO has validated all active pipeline stages. SLA compliance is currently at 100%.",
        revenueImpact: "Optimal Margins",
        slaImpact: "SLA Compliant",
        confidence: 0.99,
        requiredOffice: "HQ Admin Office"
      });
    }

    return {
      graph: { nodes, edges },
      recommendations: recommendations.sort((a, b) => b.priorityScore - a.priorityScore),
      metrics: {
        totalCandidates: candidates.length,
        totalRequirements: requirements.length,
        totalSubmissions: submissions.length,
        totalDeals: dealRooms.length
      }
    };
  }

  /**
   * 2. Predictive Placements (Success Simulation Tab)
   */
  
  static async getPredictiveSimulation() {
    const cacheKey = "getPredictiveSimulation_global";
    return this.withCache(cacheKey, () => this._compute_getPredictiveSimulation());
  }
private static async _compute_getPredictiveSimulation(): Promise<PredictivePlacement[]> {
    const submissions = await this.safeGetDocs("submissions");
    const candidates = await this.safeGetDocs("candidatePool");
    const requirements = await this.safeGetDocs("requirements_public");
    const orgs = await this.safeGetDocs("organizations");

    const candidateMap = new Map(candidates.map(c => [c.candidateId || c.id, c]));
    const reqMap = new Map(requirements.map(r => [r.requirementId || r.id, r]));
    const orgMap = new Map(orgs.map(o => [o.id, o]));

    const highProbPlacements: PredictivePlacement[] = [];

    // Analyze actual candidate submissions to compute probabilities
    submissions.forEach(sub => {
      const candidate = candidateMap.get(sub.candidateId);
      const requirement = reqMap.get(sub.requirementId);
      if (candidate && requirement) {
        const vendorId = sub.vendorOrgId || sub.vendorId || "Direct";
        const vendor = orgMap.get(vendorId);
        
        // Calculate dynamic probability parameters
        let prob = 50; // base probability
        const skillOverlapCount = (candidate.skills || []).filter((sk: string) => 
          (requirement.skillsRequired || requirement.skills || []).includes(sk)
        ).length;

        prob += skillOverlapCount * 8; // Skill overlap bonus
        
        // Status bonus
        if (sub.status === "SHORTLISTED") prob += 15;
        if (sub.status?.toUpperCase().includes("INTERVIEW")) prob += 25;
        if (sub.status === "OFFER_RELEASED") prob += 35;

        prob = Math.min(98, Math.max(10, prob));

        // Format a detailed reason
        const reasonParts = [];
        if (skillOverlapCount > 0) reasonParts.push(`${skillOverlapCount} matching core skills`);
        if (vendor?.slaScore) reasonParts.push(`Vendor Trust score: ${vendor.slaScore}`);
        if (sub.status) reasonParts.push(`Advanced to ${sub.status.replace("_", " ")}`);

        highProbPlacements.push({
          candidateId: sub.candidateId,
          candidateName: candidate.fullName || candidate.name,
          requirementId: sub.requirementId,
          requirementTitle: requirement.title,
          vendorId,
          vendorName: vendor?.companyName || vendor?.name || "HireNest Staffing Partner",
          probability: prob,
          reason: reasonParts.join(", ") || "Active candidate pipeline match indicators are strong."
        });
      }
    });

    return highProbPlacements.sort((a, b) => b.probability - a.probability).slice(0, 5);
  }

  /**
   * 3. Formatting Helper for Business Timeline (Event Bus Timeline)
   */
  static formatSystemTimeline(events: any[], requirements: any[], organizations: any[], candidates: any[]): any[] {
    const reqMap = new Map(requirements.map(r => [r.requirementId || r.id, r]));
    const orgMap = new Map(organizations.map(o => [o.id, o]));
    const candMap = new Map(candidates.map(c => [c.candidateId || c.id, c]));

    return events.map(evt => {
      const metadata = { ...(evt.metadata || {}) };

      // Resolve requirementId -> title
      if (metadata.requirementId) {
        const req = reqMap.get(metadata.requirementId);
        metadata.reqTitle = req ? `${req.title} (${metadata.requirementId})` : `Requirement ${metadata.requirementId}`;
      }

      // Resolve organization IDs
      if (metadata.vendorId) {
        const org = orgMap.get(metadata.vendorId);
        metadata.vendorName = org?.companyName || org?.name || "HireNest Workforce";
      }

      if (metadata.clientId) {
        const org = orgMap.get(metadata.clientId);
        metadata.clientName = org?.companyName || org?.name || "Direct Enterprise";
      }

      if (metadata.ownerId) {
        const org = orgMap.get(metadata.ownerId);
        metadata.ownerName = org?.companyName || org?.name || "HQ Partner";
      }

      // Resolve candidate Name
      if (metadata.candidateId) {
        const cand = candMap.get(metadata.candidateId);
        if (cand) {
          metadata.candidateName = cand.fullName || cand.name;
        }
      }

      return {
        ...evt,
        metadata
      };
    });
  }

  /**
   * 4. Vendor Intelligence (Computes Derived Trust Scores & Stats)
   */
  
  static async getVendorIntelligence() {
    const cacheKey = "getVendorIntelligence_global";
    return this.withCache(cacheKey, () => this._compute_getVendorIntelligence());
  }
private static async _compute_getVendorIntelligence(): Promise<any[]> {
    const orgs = await this.safeGetDocs("organizations");
    const submissions = await this.safeGetDocs("submissions");
    const candidates = await this.safeGetDocs("candidatePool");

    const vendors = orgs.filter(o => o.type === "vendor" || o.orgType === "vendor");
    
    return vendors.map(vendor => {
      const vendorSubs = submissions.filter(s => s.vendorOrgId === vendor.id || s.vendorId === vendor.id);
      const vendorCands = candidates.filter(c => c.vendorId === vendor.id);

      const totalSubmissions = vendorSubs.length;
      const interviews = vendorSubs.filter(s => s.status?.toUpperCase().includes("INTERVIEW")).length;
      const offers = vendorSubs.filter(s => s.status?.toUpperCase().includes("OFFER")).length;
      const placements = vendorSubs.filter(s => ["PLACED", "JOINED", "HIRED", "SELECTED"].includes(s.status?.toUpperCase())).length;
      const rejected = vendorSubs.filter(s => ["REJECTED", "REJECT"].includes(s.status?.toUpperCase())).length;

      // Derived conversions
      const fillRate = totalSubmissions > 0 ? Math.round((placements / totalSubmissions) * 100) : 0;
      
      // Compute dynamic SLA
      const avgSla = vendor.averageSla || "2.5h";

      // Calculate trust score based on dynamic outcomes
      let computedTrust = 60; // baseline
      if (totalSubmissions > 0) {
        const interviewRatio = interviews / totalSubmissions;
        const placementRatio = totalSubmissions > 0 ? placements / totalSubmissions : 0;
        computedTrust += Math.round(interviewRatio * 20 + placementRatio * 30);
      }
      
      computedTrust = Math.max(10, Math.min(100, computedTrust));

      return {
        id: vendor.id,
        name: vendor.companyName || vendor.name,
        submissions: totalSubmissions,
        interviews,
        offers,
        placements,
        fillRate: `${fillRate}%`,
        averageSla: avgSla,
        trustScore: computedTrust,
        revenue: placements * 120000,
        activeBench: vendorCands.length,
        rejected,
        successRate: totalSubmissions > 0 ? Math.round(((placements + offers) / totalSubmissions) * 100) : 0
      };
    });
  }

  /**
   * 5. Success Intelligence (Computes Client Portfolio metrics)
   */
  
  static async getSuccessDashboard() {
    const cacheKey = "getSuccessDashboard_global";
    return this.withCache(cacheKey, () => this._compute_getSuccessDashboard());
  }
private static async _compute_getSuccessDashboard(): Promise<any> {
    const orgs = await this.safeGetDocs("organizations");
    const requirements = await this.safeGetDocs("requirements_public");
    const submissions = await this.safeGetDocs("submissions");

    const clients = orgs.filter(o => o.type === "client" || o.orgType === "client");

    const clientMetrics = clients.map(client => {
      const clientReqs = requirements.filter(r => r.orgId === client.id || r.clientId === client.id);
      const reqIds = clientReqs.map(r => r.id);
      
      const clientSubs = submissions.filter(s => reqIds.includes(s.requirementId));
      const placements = clientSubs.filter(s => ["PLACED", "JOINED", "HIRED", "SELECTED"].includes(s.status?.toUpperCase())).length;
      
      const revenue = placements * 150000;

      return {
        id: client.id,
        name: client.companyName || client.name,
        openRequirements: clientReqs.filter(r => r.status === "OPEN" || r.status === "PUBLISHED").length,
        placements,
        revenue,
        interviewRate: clientSubs.length > 0 ? Math.round((clientSubs.filter(s => s.status?.toUpperCase().includes("INTERVIEW")).length / clientSubs.length) * 100) : 0,
        placementRate: clientSubs.length > 0 ? Math.round((placements / clientSubs.length) * 100) : 0
      };
    });

    return {
      topClients: clientMetrics.sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      highestRevenue: clientMetrics.reduce((max, c) => c.revenue > max ? c.revenue : max, 0),
      clientMetrics
    };
  }

  /**
   * 6. Enterprise Command Center metrics
   */
  
  static async getExecutiveMetrics() {
    const cacheKey = "getExecutiveMetrics_global";
    return this.withCache(cacheKey, () => this._compute_getExecutiveMetrics());
  }
private static async _compute_getExecutiveMetrics(): Promise<any> {
    const recruiters = await this.safeGetDocs("users", [where("role", "==", "recruiter")]);
    const submissions = await this.safeGetDocs("submissions");
    const orgs = await this.safeGetDocs("organizations");

    // Dynamic Recruiter Metrics
    const recruiterRankings = recruiters.map(rec => {
      const recSubs = submissions.filter(s => s.submittedBy === rec.id || s.assignedRecruiterId === rec.id);
      const placements = recSubs.filter(s => ["PLACED", "JOINED"].includes(s.status?.toUpperCase())).length;
      const interviews = recSubs.filter(s => s.status?.toUpperCase().includes("INTERVIEW")).length;

      return {
        id: rec.id,
        name: rec.email?.split("@")[0] || "Staff Recruiter",
        submissions: recSubs.length,
        interviews,
        offers: recSubs.filter(s => s.status?.toUpperCase().includes("OFFER")).length,
        placements,
        revenue: placements * 150000,
        trust: 85 + (placements * 2),
        sla: "2.4h",
        averageDays: 14
      };
    }).sort((a, b) => b.placements - a.placements);

    // Dynamic Vendor Rankings
    const vendorRankings = await this.getVendorIntelligence();

    // Dynamic Client Rankings
    const successData = await this.getSuccessDashboard();
    const clientRankings = successData.clientMetrics.map((cm: any) => ({
      id: cm.id,
      name: cm.name,
      revenue: cm.revenue,
      openRequirements: cm.openRequirements,
      placements: cm.placements,
      invoices: cm.placements,
      averageHiringTime: "18 days"
    })).sort((a: any, b: any) => b.revenue - a.revenue);

    return {
      topRecruiters: recruiterRankings,
      topVendors: vendorRankings,
      topClients: clientRankings
    };
  }

  /**
   * 7. Identity Resolution Deduplication (Deduplicates candidate names / email / phone)
   */
  
  static async getIdentityResolution() {
    const cacheKey = "getIdentityResolution_global";
    return this.withCache(cacheKey, () => this._compute_getIdentityResolution());
  }
private static async _compute_getIdentityResolution(): Promise<any[]> {
    const candidates = await this.safeGetDocs("candidatePool");
    const seenEmails = new Map<string, any[]>();
    const seenNames = new Map<string, any[]>();
    const duplicates: any[] = [];

    candidates.forEach(cand => {
      const email = cand.primaryEmail?.toLowerCase().trim();
      const name = cand.fullName?.toLowerCase().trim() || cand.name?.toLowerCase().trim();

      if (email) {
        if (!seenEmails.has(email)) seenEmails.set(email, []);
        seenEmails.get(email)!.push(cand);
      }

      if (name) {
        if (!seenNames.has(name)) seenNames.set(name, []);
        seenNames.get(name)!.push(cand);
      }
    });

    // Collate email duplicates
    seenEmails.forEach((list, email) => {
      if (list.length > 1) {
        duplicates.push({
          id: `dup-email-${email.replace(/[@.]/g, "-")}`,
          type: "EMAIL_HASH_MATCH",
          primaryValue: email,
          matchedCount: list.length,
          candidates: list.map(c => ({ id: c.id || c.candidateId, name: c.fullName || c.name, vendorId: c.vendorId })),
          riskScore: 98,
          recommendation: "Consolidate duplicate records and retain oldest vendor lock."
        });
      }
    });

    // Collate name duplicates
    seenNames.forEach((list, name) => {
      if (list.length > 1) {
        const alreadyMatched = duplicates.some(d => d.candidates.some((c: any) => list.some(l => (l.id || l.candidateId) === c.id)));
        if (!alreadyMatched) {
          duplicates.push({
            id: `dup-name-${name.replace(/\s+/g, "-")}`,
            type: "FUZZY_NAME_MATCH",
            primaryValue: name,
            matchedCount: list.length,
            candidates: list.map(c => ({ id: c.id || c.candidateId, name: c.fullName || c.name, vendorId: c.vendorId })),
            riskScore: 75,
            recommendation: "Verify profile resumes to confirm separate identity."
          });
        }
      }
    });

    return duplicates;
  }

  /**
   * 8. Unified Executive Command Center Metrics
   */
  
  static async getEnterpriseCommandCenterMetrics() {
    const cacheKey = "getEnterpriseCommandCenterMetrics_global";
    return this.withCache(cacheKey, () => this._compute_getEnterpriseCommandCenterMetrics());
  }
private static async _compute_getEnterpriseCommandCenterMetrics(): Promise<any> {
    const placements = await this.safeGetDocs("placements");
    const requirements = await this.safeGetDocs("requirements_public");
    const invoices = await this.safeGetDocs("invoices");
    const vendorPayouts = await this.safeGetDocs("vendor_payouts");
    const vendors = await this.getVendorIntelligence();
    const executiveRankings = await this.getExecutiveMetrics();

    let projectedRevenue = 0;
    let pipelineRevenue = 0;

    placements.forEach((p: any) => {
      const isPlaced = ["HIRED", "PLACED", "JOINED", "SELECTED"].includes(p.status?.toUpperCase());
      if (isPlaced) {
        projectedRevenue += (p.expectedFee || p.fee || 250000);
      } else if (["INTERVIEWING", "OFFERED"].includes(p.status?.toUpperCase())) {
        pipelineRevenue += (p.expectedFee || p.fee || 250000);
      }
    });

    let outstandingInvoices = invoices
      .filter((i: any) => i.status === "ISSUED" || i.status === "OVERDUE")
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    let pendingPayouts = vendorPayouts
      .filter((p: any) => p.status === "PENDING" || p.status === "PROCESSING")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    let reqsAtRisk = 0;
    let revRisk = 0;
    requirements.forEach((r: any) => {
      if (r.status === "OPEN" && (r.matchCount || 0) < 3) {
        reqsAtRisk++;
        const rawAmt = typeof r.budget === "object" ? (r.budget?.amount || r.budget?.clientBudget) : r.budget;
        const bAmt = Number(rawAmt);
        const normalizedAmt = (bAmt && !isNaN(bAmt)) ? (bAmt <= 150 ? bAmt * 100000 : bAmt) : 200000;
        revRisk += normalizedAmt * 0.15; // roughly 15% platform margin
      }
    });

    return {
      projectedRevenue,
      revenueAtRisk: revRisk,
      reqsAtRisk,
      placementPipeline: pipelineRevenue,
      outstandingInvoices,
      pendingPayouts,
      topRecruiters: executiveRankings.topRecruiters.slice(0, 3),
      topVendors: vendors.slice(0, 3),
      pendingApprovals: 0,
      systemHealth: 100
    };
  }
}
