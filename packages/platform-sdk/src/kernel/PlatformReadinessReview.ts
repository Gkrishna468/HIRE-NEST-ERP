export interface PRRChecklist {
  compatibilitySuite: boolean;
  policyEnforcement: boolean;
  auditCoverage: boolean;
  telemetryCoverage: boolean;
  providerFailover: boolean;
  capabilityRouting: boolean;
  registryDiscovery: boolean;
  contractVersioning: boolean;
  securityReview: boolean;
  performanceBaseline: boolean;
}

export function validatePlatformReadiness(checklist: PRRChecklist) {
  const missing = Object.entries(checklist).filter(([_, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Platform Readiness Review (PRR) Failed. Missing gates: ${missing.join(', ')}`);
  }
  return true;
}
