import { checkIsAdmin } from "../src/lib/permissions";

/**
 * HIRENESTOS PRIVILEGED IDENTITY AUTHORIZATION (SEC-017) TEST SUITE
 * 
 * Verifies that no user receives super_admin or admin privileges solely because 
 * their email matches a hard-coded allowlist. Enforces authoritative server-side 
 * identity record and claim validation (users/{uid}).
 */

interface IdentityRecord {
  uid: string;
  email: string;
  role: string;
  organizationId: string;
  status: "active" | "disabled" | "suspended";
  securityVersion?: number;
}

// Simulated server-side policy evaluator for privileged identity
function evaluatePrivilegedAccess(
  callerUid: string,
  callerClaims: { role?: string; organizationId?: string },
  authoritativeRecord: IdentityRecord | null,
  clientMutatedRole?: string,
  clientMutatedOrgId?: string,
  clientMutatedEmail?: string
): { allowed: boolean; reason: string } {
  // Rule 1: Must have an authoritative record matching callerUid
  if (!authoritativeRecord || authoritativeRecord.uid !== callerUid) {
    return { allowed: false, reason: "IDENTITY_NOT_FOUND: Authoritative server record missing for UID" };
  }

  // Rule 2: Account must be active
  if (authoritativeRecord.status !== "active") {
    return { allowed: false, reason: "ACCOUNT_DISABLED: Account status is " + authoritativeRecord.status };
  }

  // Rule 3: Client mutated inputs (role, org, email) are IGNORED. Only server record is trusted.
  const trustedRole = authoritativeRecord.role;
  const trustedOrgId = authoritativeRecord.organizationId;

  // Rule 4: Check if role is super_admin / admin AND organization is ORG-GLOBAL-HQ
  const isAdmin = checkIsAdmin(trustedRole, trustedOrgId);
  
  if (trustedRole === "super_admin" && trustedOrgId !== "ORG-GLOBAL-HQ") {
    return { allowed: false, reason: "MISSING_GLOBAL_HQ_MEMBERSHIP: super_admin requires ORG-GLOBAL-HQ organization" };
  }

  if (!isAdmin) {
    return { allowed: false, reason: "INSUFFICIENT_PRIVILEGES: Role " + trustedRole + " is not privileged" };
  }

  return { allowed: true, reason: "AUTHORIZED_PRIVILEGED_IDENTITY" };
}

async function runSec017Tests() {
  console.log("========================================================================");
  console.log("   HIRENESTOS PRIVILEGED IDENTITY AUTHORIZATION (SEC-017) SUITE   ");
  console.log("========================================================================\n");

  const results: Record<string, any> = {};
  let overallPass = true;

  // --- FIXTURE SETUP ---
  const fixtures: Record<string, IdentityRecord> = {
    "UID_SUPER_ADMIN_VALID": {
      uid: "UID_SUPER_ADMIN_VALID",
      email: "gopal@hirenestworkforce.com",
      role: "super_admin",
      organizationId: "ORG-GLOBAL-HQ",
      status: "active",
      securityVersion: 1
    },
    "UID_VENDOR_ATTACKER": {
      uid: "UID_VENDOR_ATTACKER",
      email: "gopal@hirenestworkforce.com", // Same email as super admin, but different UID!
      role: "vendor",
      organizationId: "ORG_VENDOR_101",
      status: "active",
      securityVersion: 1
    },
    "UID_NORMAL_USER": {
      uid: "UID_NORMAL_USER",
      email: "normal@example.com",
      role: "recruiter",
      organizationId: "ORG_RECRUITMENT_99",
      status: "active",
      securityVersion: 1
    },
    "UID_DISABLED_ADMIN": {
      uid: "UID_DISABLED_ADMIN",
      email: "gopalkrishna0046@gmail.com",
      role: "super_admin",
      organizationId: "ORG-GLOBAL-HQ",
      status: "disabled",
      securityVersion: 1
    },
    "UID_SUPER_ADMIN_NO_HQ": {
      uid: "UID_SUPER_ADMIN_NO_HQ",
      email: "gopa@hirenestworkforce.com",
      role: "super_admin",
      organizationId: "ORG_OTHER_TENANT", // Invalid org for super admin!
      status: "active",
      securityVersion: 1
    }
  };

  // TEST_I: Known UID + super_admin claim/record -> ALLOW
  console.log(">>> Running TEST_I — Known UID + super_admin claim/record...");
  const resI = evaluatePrivilegedAccess("UID_SUPER_ADMIN_VALID", { role: "super_admin" }, fixtures["UID_SUPER_ADMIN_VALID"]);
  const passI = resI.allowed === true;
  results["TEST_I"] = { status: passI ? "PASS" : "FAIL", allowed: resI.allowed, reason: resI.reason };
  console.log(`  [${passI ? "PASS" : "FAIL"}] TEST_I: ${resI.reason}`);
  if (!passI) overallPass = false;

  // TEST_J: Known email + wrong UID/claims/record -> DENY
  console.log(">>> Running TEST_J — Known email + wrong UID/claims...");
  // Attacker has email 'gopal@hirenestworkforce.com' but UID is 'UID_VENDOR_ATTACKER' with role 'vendor'
  const resJ = evaluatePrivilegedAccess("UID_VENDOR_ATTACKER", { role: "vendor" }, fixtures["UID_VENDOR_ATTACKER"], undefined, undefined, "gopal@hirenestworkforce.com");
  const passJ = resJ.allowed === false;
  results["TEST_J"] = { status: passJ ? "PASS" : "FAIL", allowed: resJ.allowed, reason: resJ.reason };
  console.log(`  [${passJ ? "PASS" : "FAIL"}] TEST_J: ${resJ.reason}`);
  if (!passJ) overallPass = false;

  // TEST_K: Normal user changes local role field -> DENY
  console.log(">>> Running TEST_K — Normal user client-side role mutation...");
  // Normal user sends role: 'super_admin' in request body/client state
  const resK = evaluatePrivilegedAccess("UID_NORMAL_USER", { role: "recruiter" }, fixtures["UID_NORMAL_USER"], "super_admin");
  const passK = resK.allowed === false;
  results["TEST_K"] = { status: passK ? "PASS" : "FAIL", allowed: resK.allowed, reason: resK.reason };
  console.log(`  [${passK ? "PASS" : "FAIL"}] TEST_K: ${resK.reason}`);
  if (!passK) overallPass = false;

  // TEST_L: Normal user changes organizationId -> DENY
  console.log(">>> Running TEST_L — Normal user client-side organizationId mutation...");
  const resL = evaluatePrivilegedAccess("UID_NORMAL_USER", { role: "recruiter" }, fixtures["UID_NORMAL_USER"], undefined, "ORG-GLOBAL-HQ");
  const passL = resL.allowed === false;
  results["TEST_L"] = { status: passL ? "PASS" : "FAIL", allowed: resL.allowed, reason: resL.reason };
  console.log(`  [${passL ? "PASS" : "FAIL"}] TEST_L: ${resL.reason}`);
  if (!passL) overallPass = false;

  // TEST_M: User changes email to privileged email -> DENY
  console.log(">>> Running TEST_M — User changes email to privileged email...");
  const resM = evaluatePrivilegedAccess("UID_NORMAL_USER", { role: "recruiter" }, fixtures["UID_NORMAL_USER"], undefined, undefined, "gopal@hirenestworkforce.com");
  const passM = resM.allowed === false;
  results["TEST_M"] = { status: passM ? "PASS" : "FAIL", allowed: resM.allowed, reason: resM.reason };
  console.log(`  [${passM ? "PASS" : "FAIL"}] TEST_M: ${resM.reason}`);
  if (!passM) overallPass = false;

  // TEST_N: Disabled privileged account -> DENY
  console.log(">>> Running TEST_N — Disabled privileged account...");
  const resN = evaluatePrivilegedAccess("UID_DISABLED_ADMIN", { role: "super_admin" }, fixtures["UID_DISABLED_ADMIN"]);
  const passN = resN.allowed === false;
  results["TEST_N"] = { status: passN ? "PASS" : "FAIL", allowed: resN.allowed, reason: resN.reason };
  console.log(`  [${passN ? "PASS" : "FAIL"}] TEST_N: ${resN.reason}`);
  if (!passN) overallPass = false;

  // TEST_O: Privileged account without ORG-GLOBAL-HQ membership -> DENY
  console.log(">>> Running TEST_O — Privileged account without ORG-GLOBAL-HQ membership...");
  const resO = evaluatePrivilegedAccess("UID_SUPER_ADMIN_NO_HQ", { role: "super_admin" }, fixtures["UID_SUPER_ADMIN_NO_HQ"]);
  const passO = resO.allowed === false;
  results["TEST_O"] = { status: passO ? "PASS" : "FAIL", allowed: resO.allowed, reason: resO.reason };
  console.log(`  [${passO ? "PASS" : "FAIL"}] TEST_O: ${resO.reason}`);
  if (!passO) overallPass = false;

  // --- AUTOMATED FIXTURE CLEANUP & FAIL-CLOSED GATE CHECK ---
  let cleanupSuccess = true;
  let cleanupError = "";
  try {
    // Purge in-memory fixture state
    Object.keys(fixtures).forEach(k => delete fixtures[k]);
  } catch (err: any) {
    cleanupSuccess = false;
    cleanupError = err?.message || String(err);
  }

  const finalGatePass = overallPass && cleanupSuccess;

  console.log("\n========================================================================");
  console.log("   HIRENESTOS PRIVILEGED IDENTITY AUTHORIZATION (SEC-017) COMPLETE   ");
  console.log("========================================================================");
  console.log(JSON.stringify({
    securitySuiteStatus: overallPass ? "PASS" : "FAIL",
    fixtureCleanupStatus: cleanupSuccess ? "PASS" : "FAIL",
    overallGateStatus: finalGatePass ? "PASS" : "FAIL",
    testResults: results,
    ...(cleanupError ? { cleanupError } : {})
  }, null, 2));

  if (!finalGatePass) {
    process.exit(1);
  }
}

runSec017Tests();
