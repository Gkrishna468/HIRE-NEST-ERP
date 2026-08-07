/** Represents the final authorization decision from the Policy Engine */
export type PolicyDecisionType = 'Allow' | 'Deny' | 'ConstrainedAllow';

/** Details of a policy evaluation result */
export interface PolicyDecision {
  type: PolicyDecisionType;
  reason?: string;
  constraints?: Record<string, any>;
}

/** Context required for evaluating a policy decision */
export interface PolicyContext {
  userId: string;
  workspaceId: string;
  resourceId?: string;
  action: string;
  attributes?: Record<string, any>;
}

/** 
 * PolicyEngineAPI provides authorization pipelines integrating 
 * RBAC, ABAC, Data Isolation, and PII constraints.
 */
export interface PolicyEngineAPI {
  /** Evaluates an authorization request context */
  evaluate(context: PolicyContext): Promise<PolicyDecision>;
}
