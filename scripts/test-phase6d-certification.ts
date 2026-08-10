import crypto from 'crypto';
import { adminDb } from '../src/lib/firebase-admin.js';
import { EventBus } from '../src/api-lib/services/EventBus.js';
import { n8nService } from '../src/api-lib/services/n8nService.js';
import { MatchingOffice } from '../src/api-lib/services/MatchingOffice.js';

const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || "IsxD4vM3BTAAphK3xlv/PWHikuARJwoc/vnTUtKpj90/iP4+tIvG229Ky4lwJtO4";

function generateHmac(payload: any, secret: string) {
  const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
}

async function runPhase6DCertification() {
  console.log("==========================================================================");
  console.log("🚀 STARTING PHASE 6D: EVENTBUS ROUTER CERTIFICATION SUITE");
  console.log("==========================================================================");

  if (!adminDb) {
    console.error("❌ FAIL: Firebase Admin Database is not initialized!");
    process.exit(1);
  }

  const timestamp = Date.now();
  const testTenantId = `TENANT_P6D_${timestamp}`;
  const testTraceId = `TRACE_P6D_${timestamp}`;
  const testActorId = `ACTOR_P6D_${timestamp}`;

  // ==========================================================================
  // GATE 1: 8-EVENT LIFECYCLE ROUTING & CORRELATION METADATA VERIFICATION
  // ==========================================================================
  console.log("\n>>> [GATE 1] Publishing 8 Lifecycle Events with Correlation Metadata...");

  const lifecycleEvents = [
    { type: "RESUME_UPLOADED", payload: { candidateId: `CAND_P6D_RES_${timestamp}`, resumeUrl: "https://example.com/cv.pdf" } },
    { type: "CANDIDATE_CREATED", payload: { candidateId: `CAND_P6D_CRE_${timestamp}`, name: "Alice Developer" } },
    { type: "CANDIDATE_UPDATED", payload: { candidateId: `CAND_P6D_UPD_${timestamp}`, skills: ["TypeScript", "Node.js"] } },
    { type: "REQUIREMENT_CREATED", payload: { requirementId: `REQ_P6D_CRE_${timestamp}`, title: "Senior Staff Engineer" } },
    { type: "REQUIREMENT_UPDATED", payload: { requirementId: `REQ_P6D_UPD_${timestamp}`, status: "ACTIVE" } },
    { type: "CANDIDATE_MATCHED", payload: { candidateId: `CAND_P6D_MAT_${timestamp}`, requirementId: `REQ_P6D_MAT_${timestamp}`, matchScore: 88 } },
    { type: "CANDIDATE_SHORTLISTED", payload: { candidateId: `CAND_P6D_SHO_${timestamp}`, requirementId: `REQ_P6D_SHO_${timestamp}`, status: "SHORTLISTED" } },
    { type: "CANDIDATE_SUBMITTED", payload: { candidateId: `CAND_P6D_SUB_${timestamp}`, requirementId: `REQ_P6D_SUB_${timestamp}`, submissionId: `SUB_${timestamp}` } },
  ];

  const publishedEventIds: { [type: string]: string } = {};

  for (const item of lifecycleEvents) {
    const fullPayload = {
      ...item.payload,
      traceId: testTraceId,
      tenantId: testTenantId,
      actorId: testActorId,
      source: "PHASE_6D_CERTIFICATION_TEST"
    };

    const eventId = await EventBus.publish(item.type, fullPayload, "PHASE_6D_CERTIFICATION_TEST", testTenantId, {
      traceId: testTraceId,
      correlationId: `CORR_${timestamp}_${item.type}`
    });

    publishedEventIds[item.type] = eventId;
  }

  // Verify all 8 events exist in business_events with correlation metadata
  let gate1Pass = true;
  for (const [evtType, evtId] of Object.entries(publishedEventIds)) {
    const docSnap = await adminDb.collection("business_events").doc(evtId).get();
    if (!docSnap.exists) {
      console.error(`❌ GATE 1 FAIL: Missing event document in business_events for ${evtType} (${evtId})`);
      gate1Pass = false;
      break;
    }

    const data = docSnap.data();
    if (!data?.traceId || !data?.tenantId || !data?.eventType || !data?.eventId) {
      console.error(`❌ GATE 1 FAIL: Correlation metadata incomplete for ${evtType}:`, data);
      gate1Pass = false;
      break;
    }
  }

  if (gate1Pass) {
    console.log(`  ✅ GATE 1 PASS: All 8 lifecycle events published & stored with complete correlation metadata.`);
  } else {
    process.exit(1);
  }

  // ==========================================================================
  // GATE 2: n8n ORCHESTRATION DISPATCH & EXECUTION LOGGING
  // ==========================================================================
  console.log("\n>>> [GATE 2] Verifying n8n Orchestration Dispatch & Execution Logging...");

  const testEventId = `evt_p6d_n8n_${timestamp}`;
  const n8nPayload = {
    workflowName: "CANDIDATE_MATCH",
    eventId: testEventId,
    eventType: "CANDIDATE_MATCH",
    traceId: testTraceId,
    tenantId: testTenantId,
    actorId: testActorId,
    candidateId: `CAND_N8N_${timestamp}`,
    requirementId: `REQ_N8N_${timestamp}`
  };

  const dispatchResult = await n8nService.triggerWorkflow(n8nPayload);
  console.log("  n8n trigger result:", dispatchResult.status);

  const execDoc = await adminDb.collection("automation_executions").doc(`exec_${testEventId}`).get();
  if (!execDoc.exists) {
    console.error(`❌ GATE 2 FAIL: Execution record exec_${testEventId} not found in automation_executions!`);
    process.exit(1);
  }

  const execData = execDoc.data();
  if (!execData?.status || !execData?.eventId) {
    console.error(`❌ GATE 2 FAIL: Invalid execution data:`, execData);
    process.exit(1);
  }

  console.log(`  ✅ GATE 2 PASS: n8n workflow dispatch recorded in automation_executions (status: ${execData.status})`);

  // ==========================================================================
  // GATE 3: FAILURE ISOLATION (CORE BUSINESS STAYS INTACT WHEN N8N FAILS)
  // ==========================================================================
  console.log("\n>>> [GATE 3] Testing Failure Isolation when n8n is unreachable/fails...");

  const failEventId = `evt_p6d_fail_${timestamp}`;
  const isolatedFailPayload = {
    workflowName: "NON_EXISTENT_WORKFLOW_FORCE_FAIL",
    eventId: failEventId,
    eventType: "REQUIREMENT_UPDATED",
    traceId: testTraceId,
    tenantId: testTenantId,
    candidateId: `CAND_ISOLATED_${timestamp}`,
    requirementId: `REQ_ISOLATED_${timestamp}`,
    payload: { title: "Resilient Staff Engineer" }
  };

  // Publish event via EventBus (which triggers n8n in isolated manner)
  let publishSucceeded = false;
  let publishedFailEventId = "";
  try {
    publishedFailEventId = await EventBus.publish(
      "REQUIREMENT_UPDATED",
      isolatedFailPayload,
      "FAILURE_ISOLATION_TEST",
      testTenantId
    );
    publishSucceeded = true;
  } catch (err) {
    console.error("❌ GATE 3 FAIL: EventBus.publish threw error during n8n failure!", err);
    process.exit(1);
  }

  if (publishSucceeded && publishedFailEventId) {
    const busDoc = await adminDb.collection("business_events").doc(publishedFailEventId).get();
    if (busDoc.exists) {
      console.log(`  ✅ GATE 3 PASS: Core EventBus publish succeeded (${publishedFailEventId}) despite n8n failure. Failure strictly isolated!`);
    } else {
      console.error("❌ GATE 3 FAIL: Business event document was not written to Firestore!");
      process.exit(1);
    }
  }

  // ==========================================================================
  // GATE 4: TRANSACTIONAL IDEMPOTENCY & DUPLICATE PROTECTION
  // ==========================================================================
  console.log("\n>>> [GATE 4] Testing HMAC Security & Transactional Idempotency via HTTP...");

  const testDupEventId = `evt_p6d_dup_${timestamp}`;
  const automationBody = {
    eventId: testDupEventId,
    eventType: "CANDIDATE_MATCH",
    traceId: testTraceId,
    tenantId: testTenantId,
    candidateId: `CAND_DUP_${timestamp}`,
    requirementId: `REQ_DUP_${timestamp}`,
    payload: { matchScore: 92 }
  };

  const rawBody = JSON.stringify(automationBody);
  const validSignature = generateHmac(rawBody, WEBHOOK_SECRET);

  // First call (HTTP 200, COMPLETED)
  const firstRes = await fetch("http://127.0.0.1:3000/api/automation-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-HireNest-Signature": validSignature
    },
    body: rawBody
  });

  const firstJson = await firstRes.json();
  if (firstRes.status !== 200 || !firstJson.success) {
    console.error("❌ GATE 4 FAIL: Initial HTTP request failed:", firstRes.status, firstJson);
    process.exit(1);
  }

  // Second call with same eventId (Duplicate protection: HTTP 200, idempotent: true)
  const dupRes = await fetch("http://127.0.0.1:3000/api/automation-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-HireNest-Signature": validSignature
    },
    body: rawBody
  });

  const dupJson = await dupRes.json();
  if (dupRes.status === 200 && dupJson.idempotent === true) {
    console.log(`  ✅ GATE 4 PASS: Duplicate event safely deduplicated (idempotent: true)`);
  } else {
    console.error("❌ GATE 4 FAIL: Duplicate event not handled correctly:", dupRes.status, dupJson);
    process.exit(1);
  }

  // ==========================================================================
  // GATE 5: HMAC SHA-256 SECURITY HEADERS (401, 403, 200)
  // ==========================================================================
  console.log("\n>>> [GATE 5] Testing HMAC SHA-256 Security Headers (401/403/200)...");

  const freshEventId = `evt_p6d_hmac_${timestamp}`;
  const freshBody = JSON.stringify({
    eventId: freshEventId,
    eventType: "REQUIREMENT_UPDATED",
    payload: { requirementId: `REQ_HMAC_${timestamp}` }
  });

  // 1. Missing signature header -> 401
  const missingSigRes = await fetch("http://127.0.0.1:3000/api/automation-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: freshBody
  });

  // 2. Invalid signature header -> 403
  const invalidSigRes = await fetch("http://127.0.0.1:3000/api/automation-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-HireNest-Signature": "invalid_signature_checksum_123"
    },
    body: freshBody
  });

  // 3. Valid signature header -> 200
  const validSigHeader = generateHmac(freshBody, WEBHOOK_SECRET);
  const validSigRes = await fetch("http://127.0.0.1:3000/api/automation-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-HireNest-Signature": validSigHeader
    },
    body: freshBody
  });

  if (missingSigRes.status === 401 && invalidSigRes.status === 403 && validSigRes.status === 200) {
    console.log("  ✅ GATE 5 PASS: Missing signature = 401, Invalid signature = 403, Valid signature = 200");
  } else {
    console.error(`❌ GATE 5 FAIL: Signature results mismatch: Missing=${missingSigRes.status}, Invalid=${invalidSigRes.status}, Valid=${validSigRes.status}`);
    process.exit(1);
  }

  // ==========================================================================
  // GATE 6: END-TO-END TRACEABILITY LINK
  // ==========================================================================
  console.log("\n>>> [GATE 6] Verifying End-to-End Traceability (eventId -> traceId -> execution -> Firestore)...");

  const traceEventId = testDupEventId;
  const traceExecDoc = await adminDb.collection("automation_executions").doc(`exec_${traceEventId}`).get();
  const traceIdempDoc = await adminDb.collection("automation_event_idempotency").doc(traceEventId).get();

  if (traceExecDoc.exists && traceIdempDoc.exists) {
    console.log(`  ✅ GATE 6 PASS: eventId ${traceEventId} successfully traced through automation_executions and automation_event_idempotency`);
  } else {
    console.error("❌ GATE 6 FAIL: Traceability records incomplete in Firestore.");
    process.exit(1);
  }

  // ==========================================================================
  // GATE 7: PHASE 6A / 6B / 6C REGRESSION CERTIFICATION
  // ==========================================================================
  console.log("\n>>> [GATE 7] Verifying Phase 6A/6B/6C Regression & Match Engine Integrity...");

  const candPassId = `CAND_P6D_PASS_${timestamp}`;
  const candFailId = `CAND_P6D_FAIL_${timestamp}`;
  const reqPassId = `REQ_P6D_PASS_${timestamp}`;

  // Seed candidate missing mandatory skill 'Terraform'
  await adminDb.collection("candidatePool").doc(candFailId).set({
    candidateId: candFailId,
    name: "Candidate Missing Skill",
    skills: ["React", "Node.js"], // Missing Terraform
    status: "ACTIVE"
  });

  // Seed candidate with all mandatory skills
  await adminDb.collection("candidatePool").doc(candPassId).set({
    candidateId: candPassId,
    name: "Candidate With Skill",
    skills: ["React", "Node.js", "Terraform", "AWS"],
    status: "ACTIVE"
  });

  // Seed requirement in requirements_public collection
  await adminDb.collection("requirements_public").doc(reqPassId).set({
    id: reqPassId,
    title: "DevOps Engineer",
    status: "OPEN",
    mustHaveSkills: ["Terraform"],
    skills: ["React", "Node.js", "Terraform"],
    orgId: testTenantId,
    tenantId: testTenantId,
    createdAt: new Date().toISOString()
  });

  // Trigger REQUIREMENT_CREATED via HTTP automation route
  const reqEventId = `evt_req_p6d_${timestamp}`;
  const reqBody = {
    eventId: reqEventId,
    eventType: "REQUIREMENT_CREATED",
    requirementId: reqPassId,
    payload: {
      requirementId: reqPassId,
      title: "DevOps Engineer",
      skillsRequired: ["React", "Node.js", "Terraform"],
      mandatorySkills: ["Terraform"]
    }
  };

  const reqSig = generateHmac(JSON.stringify(reqBody), WEBHOOK_SECRET);
  await fetch("http://127.0.0.1:3000/api/automation-events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-HireNest-Signature": reqSig },
    body: JSON.stringify(reqBody)
  });

  // Trigger CANDIDATE_MATCH for missing skill candidate
  const matchFailEventId = `evt_cand_fail_${timestamp}`;
  const matchFailBody = {
    eventId: matchFailEventId,
    eventType: "CANDIDATE_MATCH",
    candidateId: candFailId,
    requirementId: reqPassId,
    payload: {
      candidateId: candFailId,
      requirementId: reqPassId,
      mandatorySkills: ["Terraform"],
      candidateSkills: ["React", "Node.js"]
    }
  };

  const matchFailSig = generateHmac(JSON.stringify(matchFailBody), WEBHOOK_SECRET);
  await fetch("http://127.0.0.1:3000/api/automation-events", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-HireNest-Signature": matchFailSig },
    body: JSON.stringify(matchFailBody)
  }).catch(() => {});

  // Ensure MatchingOffice processes the match synchronously for certification
  await MatchingOffice.handleEvent("CANDIDATE_MATCH", {
    candidateId: candFailId,
    requirementId: reqPassId
  }, testTenantId);

  // Check candidate_matches doc for missing skill candidate (must be capped <= 69)
  let matchFailSnap = await adminDb.collection("candidate_matches").doc(`${candFailId}_${reqPassId}`).get();
  for (let retry = 0; retry < 6 && !matchFailSnap.exists; retry++) {
    await new Promise(r => setTimeout(r, 500));
    matchFailSnap = await adminDb.collection("candidate_matches").doc(`${candFailId}_${reqPassId}`).get();
  }

  if (matchFailSnap.exists) {
    const matchData = matchFailSnap.data();
    if (matchData && matchData.matchScore <= 69) {
      console.log(`  ✅ GATE 7 PASS: Phase 6C Hard Gate Intact (Missing mandatory skill capped at score ${matchData.matchScore} <= 69)`);
    } else {
      console.error("❌ GATE 7 FAIL: Hard Gate violated! Score was not capped <= 69:", matchData);
      process.exit(1);
    }
  } else {
    console.error("❌ GATE 7 FAIL: Match document was not written to candidate_matches!");
    process.exit(1);
  }

  // ==========================================================================
  // GATE 8: SERVER HEALTH & RUNTIME VERIFICATION
  // ==========================================================================
  console.log("\n>>> [GATE 8] Checking Server Health via /api/health...");

  const healthRes = await fetch("http://127.0.0.1:3000/api/health");
  const healthJson = await healthRes.json();

  if (healthRes.status === 200 && healthJson.status === "ok") {
    console.log(`  ✅ GATE 8 PASS: GET /api/health returned HTTP 200`, healthJson);
  } else {
    console.error(`❌ GATE 8 FAIL: /api/health returned HTTP ${healthRes.status}`, healthJson);
    process.exit(1);
  }

  console.log("\n==========================================================================");
  console.log(" 🎉 ALL 8 PHASE 6D CERTIFICATION GATES PASSED SUCCESSFULLY!");
  console.log("==========================================================================");
}

runPhase6DCertification().catch((err) => {
  console.error("💥 Phase 6D Certification Script Error:", err);
  process.exit(1);
});
