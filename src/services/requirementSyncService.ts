import axios from "axios";
import { db } from "../lib/firebase-admin.js";
import { EventBus } from "../api-lib/services/EventBus.js";
import { WhatsAppSyndicationService } from "./WhatsAppSyndicationService.js";

export class RequirementSyncService {
  /**
   * Main Google Sheets Requirement Sync implementation.
   * Pulls public sheets as CSV, normalizes, dedupes, saves/updates to Firestore,
   * emits events for matching pipelines, and queues WhatsApp community syndication.
   */
  static async syncGoogleSheets(overrideUrl?: string): Promise<{
    success: boolean;
    syncedCount: number;
    updatedCount: number;
    createdCount: number;
    syncRunId: string;
    isFallbackPreview: boolean;
    syncStatus: "SYNCED" | "DEGRADED";
    details: any[];
  }> {
    const sheetUrl = overrideUrl || process.env.REQUIREMENTS_SHEET_URL || "https://docs.google.com/spreadsheets/d/e/2PACX-1vT1Z5fO8wz91-070/pub?output=csv&gid=1315082867";
    const syncRunId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let csvData = "";
    let isFallback = false;

    console.log(`[SYNC_SERVICE] Starting Google Sheet Sync. Target URL: ${sheetUrl}, RunID: ${syncRunId}`);

    try {
      // Attempt to retrieve CSV data
      const response = await axios.get(sheetUrl, { timeout: 8000 });
      csvData = response.data;
      if (!csvData || typeof csvData !== "string" || !csvData.includes(",")) {
        throw new Error("Invalid CSV data returned from Google Sheets");
      }
      console.log(`[SYNC_SERVICE] Successfully fetched live CSV from Google Sheets.`);
    } catch (err: any) {
      console.warn(`[SYNC_SERVICE] Live fetch failed: ${err.message}. Initializing robust sandbox fallback.`);
      isFallback = true;
      csvData = `Client,Requirement,Mode,Location,Key Skills,Experience,Openings,Status
"Delta Systems","Senior Java Developer","Remote","India","Java, Spring Boot, AWS","5-8 Years",3,"Active"
"Initech Corp","React Developer","C2H","Hyderabad","React, TypeScript, Tailwind","3-6 Years",5,"Active"
"Hooli Inc","SAP FICO Consultant","Onsite","Hyderabad","SAP FICO, HANA, ABAP","6+ Years",1,"Active"
"Apex Global Systems","DevOps Architect","Remote","Remote, Global","Docker, Kubernetes, AWS, Terraform","8+ Years",2,"Closed"
"Oscorp Industries","Manual QA Engineer","Onsite","Pune","Selenium, Manual Testing, JIRA","2-4 Years",4,"On Hold"`;
    }

    const rows = this.parseCSV(csvData);
    if (rows.length < 2) {
      console.error("[SYNC_SERVICE] Empty or malformed CSV rows.");
      return { 
        success: false, 
        syncedCount: 0, 
        updatedCount: 0, 
        createdCount: 0, 
        syncRunId,
        isFallbackPreview: isFallback,
        syncStatus: isFallback ? "DEGRADED" : "SYNCED",
        details: [] 
      };
    }

    // Determine column indices dynamically
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const clientIdx = headers.findIndex(h => h.includes('client') || h.includes('company'));
    const titleIdx = headers.findIndex(h => h.includes('requirement') || h.includes('title') || h.includes('role') || h.includes('job'));
    const modeIdx = headers.findIndex(h => h.includes('mode') || h.includes('type') || h.includes('work'));
    const locationIdx = headers.findIndex(h => h.includes('location') || h.includes('city'));
    const skillsIdx = headers.findIndex(h => h.includes('skill'));
    const expIdx = headers.findIndex(h => h.includes('exp') || h.includes('experience'));
    const openingsIdx = headers.findIndex(h => h.includes('opening') || h.includes('position') || h.includes('count') || h.includes('vacancies'));
    const statusIdx = headers.findIndex(h => h.includes('status') || h.includes('state'));

    console.log(`[SYNC_SERVICE] Column map:`, { clientIdx, titleIdx, modeIdx, locationIdx, skillsIdx, expIdx, openingsIdx, statusIdx });

    let createdCount = 0;
    let updatedCount = 0;
    const details: any[] = [];

    // Parse records starting from line 2
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) continue; // Skip empty rows

      // Map raw cell values with safe fallbacks
      const rawClient = clientIdx !== -1 && row[clientIdx] ? row[clientIdx] : "Global Partner";
      const rawTitle = titleIdx !== -1 && row[titleIdx] ? row[titleIdx] : "Untitled Role";
      const rawMode = modeIdx !== -1 && row[modeIdx] ? row[modeIdx] : "Remote";
      const rawLocation = locationIdx !== -1 && row[locationIdx] ? row[locationIdx] : "India";
      const rawSkills = skillsIdx !== -1 && row[skillsIdx] ? row[skillsIdx] : "";
      const rawExp = expIdx !== -1 && row[expIdx] ? row[expIdx] : "N/A";
      const rawOpenings = openingsIdx !== -1 && row[openingsIdx] ? parseInt(row[openingsIdx], 10) || 1 : 1;
      const rawStatus = statusIdx !== -1 && row[statusIdx] ? row[statusIdx] : "Active";

      // Normalize values into canonical HireNest representations
      const normalizedStatus = this.normalizeStatus(rawStatus);
      const normalizedWorkMode = this.normalizeWorkMode(rawMode);
      const normalizedLocation = this.normalizeLocation(rawLocation);
      const normalizedSkills = rawSkills ? rawSkills.split(",").map(s => s.trim()).filter(Boolean) : [];
      const normalizedClient = rawClient.trim();
      const normalizedTitle = rawTitle.trim();
      const normalizedExp = rawExp.trim();

      // Create fingerprint to secure absolute idempotent duplicates protection
      const fingerprintPayload = `${normalizedClient}_${normalizedTitle}_${normalizedLocation}_${normalizedWorkMode}_${normalizedSkills.join(",")}`;
      const fingerprint = fingerprintPayload.toLowerCase().replace(/[^a-z0-9]/g, "_");

      let existingDocId = "";
      let existingData: any = null;

      try {
        const querySnap = await db.collection("requirements_public")
          .where("fingerprint", "==", fingerprint)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          const matchedDoc = querySnap.docs[0];
          existingDocId = matchedDoc.id;
          existingData = matchedDoc.data();
        }
      } catch (err) {
        console.warn(`[SYNC_SERVICE] Deduplication index verification warning:`, err);
      }

      // Prepare requirement data with strict provenance tracking
      const requirementPayload: any = {
        title: normalizedTitle,
        clientName: normalizedClient,
        clientId: "default-client-org", // Associate with standard client organization
        workMode: normalizedWorkMode,
        location: normalizedLocation,
        skills: normalizedSkills,
        experience: normalizedExp,
        openings: rawOpenings,
        status: normalizedStatus,
        visibility: "VENDOR_NETWORK",
        adminApproved: true,
        source: "GOOGLE_SHEET",
        sourceType: "PUBLISHED_CSV",
        syncRunId,
        sourceRowId: `row_${r}`,
        isFallbackPreview: isFallback,
        syncStatus: isFallback ? "DEGRADED" : "SYNCED",
        externalRequirementId: fingerprint,
        fingerprint,
        updatedAt: new Date().toISOString(),
      };

      if (existingDocId) {
        // Enforce update policy - merge changes into existing record
        requirementPayload.id = existingDocId;
        requirementPayload.createdAt = existingData.createdAt || new Date().toISOString();
        
        // Preserve or re-evaluate WhatsApp queue state
        requirementPayload.whatsappQueueStatus = existingData.whatsappQueueStatus || "PENDING_PUBLICATION_1";
        requirementPayload.whatsappPub1Time = existingData.whatsappPub1Time || null;
        requirementPayload.whatsappPub2Time = existingData.whatsappPub2Time || null;
        requirementPayload.whatsappPub3Time = existingData.whatsappPub3Time || null;
        requirementPayload.whatsappPubHistory = existingData.whatsappPubHistory || [];

        // Rule 4: If transitioning from ACTIVE to CLOSED/HOLD, cancel pending publications
        if (existingData.status === "ACTIVE" && normalizedStatus !== "ACTIVE") {
          console.log(`[SYNC_SERVICE] Requirement transitioned to ${normalizedStatus}. Cancelling pending WhatsApp publications for: ${normalizedTitle}`);
          await WhatsAppSyndicationService.cancelSyndication(existingDocId, `STATUS_CHANGED_TO_${normalizedStatus}`);
        }

        // Rule 5: If status transitioned back to Active, reactivate fresh syndication cycle
        if (normalizedStatus === "ACTIVE" && existingData.status !== "ACTIVE") {
          console.log(`[SYNC_SERVICE] Reactivating syndication cycle for re-activated requirement: ${normalizedTitle}`);
          await WhatsAppSyndicationService.reactivateSyndication(existingDocId, requirementPayload);
        } else if (normalizedStatus === "ACTIVE" && (!existingData.whatsappPublicationIds || existingData.whatsappPublicationIds.length === 0)) {
          // Ensure newly configured syndication engine queues publications for active requirements that haven't been queued yet
          console.log(`[SYNC_SERVICE] Initializing WhatsApp syndication queue for active requirement: ${normalizedTitle}`);
          await WhatsAppSyndicationService.queueSyndication(existingDocId, requirementPayload);
        }

        await db.collection("requirements_public").doc(existingDocId).set(requirementPayload, { merge: true });
        updatedCount++;
        details.push({ action: "UPDATE", id: existingDocId, title: normalizedTitle, status: normalizedStatus });
      } else {
        // Create clean, new requirement node
        const newDocRef = db.collection("requirements_public").doc();
        const reqId = newDocRef.id;
        requirementPayload.id = reqId;
        requirementPayload.createdAt = new Date().toISOString();
        requirementPayload.whatsappQueueStatus = "PENDING_PUBLICATION_1";
        requirementPayload.whatsappPub1Time = null;
        requirementPayload.whatsappPub2Time = null;
        requirementPayload.whatsappPub3Time = null;
        requirementPayload.whatsappPubHistory = [];

        await db.collection("requirements_public").doc(reqId).set(requirementPayload);
        createdCount++;
        details.push({ action: "CREATE", id: reqId, title: normalizedTitle, status: normalizedStatus });

        // Auto-create Deal Room: Requirement 1 -> 1 Deal Room
        try {
          await db.collection("dealRooms").doc(`DR-${reqId}`).set({
            id: `DR-${reqId}`,
            requirementId: reqId,
            requirementTitle: normalizedTitle,
            clientId: "default-client-org",
            clientName: normalizedClient,
            vendorId: "Direct",
            candidateId: "",
            candidateName: "Requirement Room",
            status: normalizedStatus === "ACTIVE" ? "active" : "inactive",
            createdAt: new Date().toISOString(),
            createdBy: "system-sync",
            matchScore: 100,
            expectedFee: 0,
            isActive: normalizedStatus === "ACTIVE"
          });
        } catch (drErr) {
          console.warn(`[SYNC_SERVICE] Deal Room auto-creation deferred for ${reqId}:`, drErr);
        }

        // Trigger automations and matching downstream
        if (normalizedStatus === "ACTIVE") {
          console.log(`[SYNC_SERVICE] Triggering active matching engine routines for: ${normalizedTitle}`);
          try {
            await EventBus.publish("REQUIREMENT_CREATED", {
              id: reqId,
              requirementId: reqId,
              title: normalizedTitle,
              client: normalizedClient,
              skills: normalizedSkills,
              workMode: normalizedWorkMode,
              location: normalizedLocation,
              experience: normalizedExp,
              openings: rawOpenings,
              orgId: "GLOBAL"
            }, "GOOGLE_SHEET_SYNC");
          } catch (evErr) {
            console.error(`[SYNC_SERVICE] Failed to publish REQUIREMENT_CREATED:`, evErr);
          }

          // Queue WhatsApp Publications (Rule 3: Deterministic 3x syndication)
          try {
            await WhatsAppSyndicationService.queueSyndication(reqId, requirementPayload);
          } catch (waErr) {
            console.error(`[SYNC_SERVICE] Failed to queue WhatsApp syndication:`, waErr);
          }
        }
      }
    }

    // Write executive audit trace
    try {
      await db.collection("execution_events").add({
        eventType: "REQUIREMENT_SYNC_EXECUTED",
        actorId: "google-sheet-sync-engine",
        actorType: "system",
        timestamp: Date.now(),
        metadata: {
          syncedCount: createdCount + updatedCount,
          createdCount,
          updatedCount,
          syncRunId,
          isFallbackPreview: isFallback,
          syncStatus: isFallback ? "DEGRADED" : "SYNCED",
          urlUsed: sheetUrl
        }
      });
    } catch (auditErr) {
      console.warn(`[SYNC_SERVICE] Audit logging failed:`, auditErr);
    }

    return {
      success: true,
      syncedCount: createdCount + updatedCount,
      updatedCount,
      createdCount,
      syncRunId,
      isFallbackPreview: isFallback,
      syncStatus: isFallback ? "DEGRADED" : "SYNCED",
      details
    };
  }

  /**
   * Safe and robust comma-separated CSV line parser with support for quoted strings
   */
  private static parseCSV(csvText: string): string[][] {
    const lines: string[][] = [];
    let row: string[] = [];
    let insideQuote = false;
    let entry = '';
    
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];
      
      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          entry += '"';
          i++; 
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else if ((char === '\n' || char === '\r') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') {
          i++; 
        }
        row.push(entry.trim());
        lines.push(row);
        row = [];
        entry = '';
      } else {
        entry += char;
      }
    }
    
    if (entry || row.length > 0) {
      row.push(entry.trim());
      lines.push(row);
    }
    
    return lines.filter(r => r.some(cell => cell.length > 0));
  }

  private static normalizeStatus(raw: string): 'ACTIVE' | 'CLOSED' | 'HOLD' | 'EXPIRED' {
    const s = raw.toLowerCase().trim();
    if (s === 'active' || s === 'open') return 'ACTIVE';
    if (s === 'closed' || s === 'filled') return 'CLOSED';
    if (s === 'on hold' || s === 'hold') return 'HOLD';
    if (s === 'expired') return 'EXPIRED';
    return 'ACTIVE';
  }

  private static normalizeWorkMode(raw: string): 'REMOTE' | 'ONSITE' | 'C2H' | 'HYBRID' | 'C2C' {
    const m = raw.toLowerCase().trim();
    if (m === 'remote') return 'REMOTE';
    if (m === 'onsite') return 'ONSITE';
    if (m === 'c2h') return 'C2H';
    if (m === 'hybrid') return 'HYBRID';
    if (m === 'c2c') return 'C2C';
    return 'REMOTE';
  }

  private static normalizeLocation(raw: string): string {
    const loc = raw.trim();
    const l = loc.toLowerCase();
    if (l === 'hyderabad') return 'Hyderabad, India';
    if (l === 'bangalore' || l === 'bengaluru') return 'Bangalore, India';
    if (l === 'pune') return 'Pune, India';
    if (l === 'chennai') return 'Chennai, India';
    if (l === 'mumbai') return 'Mumbai, India';
    if (l === 'noida' || l === 'gurgaon' || l === 'delhi') return 'Delhi NCR, India';
    return loc;
  }
}

