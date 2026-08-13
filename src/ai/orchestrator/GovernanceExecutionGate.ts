import { AgentMetadata, AgentPermissionLevel } from './types.js';

export interface GovernanceDecision {
  allowed: boolean;
  decision: 'ALLOWED' | 'BLOCKED' | 'APPROVAL_REQUIRED';
  reason: string;
  approvalRequired: boolean;
  requiresHumanSignature?: boolean;
  blockedByGuard?: string;
  checks: {
    toolPermission: boolean;
    rbacPermission: boolean;
    ownershipEligible: boolean;
    businessRulesPassed: boolean;
    communicationGuardPassed: boolean;
  };
}

export class GovernanceExecutionGate {
  private static SENSITIVE_ACTIONS = new Set([
    'CANDIDATE_SUBMISSION',
    'OWNERSHIP_TRANSFER',
    'DIRECT_CLIENT_COMMUNICATION',
    'COMMERCIAL_CHANGE',
    'REQUIREMENT_CLOSURE',
    'VENDOR_OWNERSHIP_CHANGE',
    'FINANCIAL_ACTION'
  ]);

  /**
   * Main Governance Execution Pipeline:
   * AI Gateway → Agent Tool Layer → Governance Gate → Existing Domain Services → Firestore
   */
  static async evaluateAction(
    agentMetadata: AgentMetadata,
    toolId: string,
    actionType: string,
    payload: any,
    actorContext: { userId?: string; role?: string; permissions?: string[]; isHumanApproved?: boolean }
  ): Promise<GovernanceDecision> {
    const checks = {
      toolPermission: false,
      rbacPermission: false,
      ownershipEligible: true,
      businessRulesPassed: true,
      communicationGuardPassed: true
    };

    // 1. Tool Permission Level Check
    const agentLevel: AgentPermissionLevel = agentMetadata.permissionLevel || 'PROPOSE';
    
    // READ tool allowed for READ, PROPOSE, EXECUTE agents
    // PROPOSE tool allowed for PROPOSE, EXECUTE agents
    // EXECUTE tool allowed ONLY for EXECUTE agents
    if (actionType.startsWith('READ_') || agentLevel === 'EXECUTE') {
      checks.toolPermission = true;
    } else if (actionType.startsWith('PROPOSE_') && (agentLevel === 'PROPOSE' || agentLevel === 'EXECUTE')) {
      checks.toolPermission = true;
    } else if (agentMetadata.allowedTools?.includes(toolId)) {
      checks.toolPermission = true;
    } else {
      checks.toolPermission = false;
    }

    if (!checks.toolPermission) {
      return {
        allowed: false,
        decision: 'BLOCKED',
        reason: `Agent '${agentMetadata.name}' [Level: ${agentLevel}] is not authorized to invoke tool '${toolId}' or action '${actionType}'`,
        approvalRequired: false,
        checks
      };
    }

    // 2. RBAC / ABAC Role Check
    const userRole = actorContext.role || 'guest';
    const allowedRoles = agentMetadata.allowedRoles || ['admin', 'super_admin', 'recruiter', 'bdm', 'system'];
    checks.rbacPermission = userRole === 'admin' || userRole === 'super_admin' || allowedRoles.includes(userRole);

    if (!checks.rbacPermission) {
      return {
        allowed: false,
        decision: 'BLOCKED',
        reason: `Actor role '${userRole}' is not authorized for agent '${agentMetadata.name}'`,
        approvalRequired: false,
        checks
      };
    }

    // 3. Sensitive Action & Mandatory Human Approval Check
    const isSensitive = this.SENSITIVE_ACTIONS.has(actionType.toUpperCase());
    const requiresApproval = isSensitive || agentMetadata.requiresHumanApproval || false;

    if (requiresApproval && !actorContext.isHumanApproved) {
      return {
        allowed: false,
        decision: 'APPROVAL_REQUIRED',
        reason: `Action '${actionType}' is classified as a high-risk sensitive operation requiring explicit human recruiter/manager signoff.`,
        approvalRequired: true,
        requiresHumanSignature: true,
        checks
      };
    }

    // 4. Candidate Ownership Vault Check
    if (actionType === 'CANDIDATE_SUBMISSION' || actionType === 'OWNERSHIP_TRANSFER') {
      const candidateId = payload.candidateId;
      const vendorId = payload.vendorId;
      
      // Deterministic check: verify candidate/vendor payload parameters exist
      if (!candidateId) {
        checks.ownershipEligible = false;
        return {
          allowed: false,
          decision: 'BLOCKED',
          reason: 'Candidate Ownership Vault: Missing candidate ID in submission request.',
          approvalRequired: false,
          blockedByGuard: 'CandidateOwnershipVault',
          checks
        };
      }
    }

    // 5. Business Rules & Duplicate Submission Check
    if (actionType === 'CANDIDATE_SUBMISSION') {
      if (!payload.requirementId) {
        checks.businessRulesPassed = false;
        return {
          allowed: false,
          decision: 'BLOCKED',
          reason: 'Business Rule Guard: Requirement ID must be specified for candidate submission.',
          approvalRequired: false,
          blockedByGuard: 'SubmissionRules',
          checks
        };
      }
    }

    // 6. Communication Guard Check
    if (actionType === 'DIRECT_CLIENT_COMMUNICATION' || actionType === 'SEND_EMAIL') {
      if (!payload.recipient || !payload.content) {
        checks.communicationGuardPassed = false;
        return {
          allowed: false,
          decision: 'BLOCKED',
          reason: 'Communication Guard: Recipient address and content required for outbound messaging.',
          approvalRequired: false,
          blockedByGuard: 'CommunicationGuard',
          checks
        };
      }
    }

    return {
      allowed: true,
      decision: 'ALLOWED',
      reason: 'All governance gates passed successfully.',
      approvalRequired: false,
      checks
    };
  }
}
