import { MCPTool, MCPToolManifest, ToolContext, ValidationResult, AuthorizationResult, ToolExecution } from '@hirenest/platform-sdk';
import { CandidateService } from '@hirenest/core-services';

export class Candidate360SummaryTool implements MCPTool<any, any> {
  readonly manifest: MCPToolManifest = {
    id: 'candidate.360.summary',
    name: 'Candidate 360 Summary',
    version: '1.0.0',
    domain: 'Candidate',
    owner: 'Platform',
    description: 'Get a 360 summary of a candidate.',
    permissions: ['candidate:read'],
    capabilities: ['summary'],
    auditLevel: 'MEDIUM',
    timeout: '5s',
    retryPolicy: 'default',
    visibility: 'internal',
    status: 'Production',
    tags: ['candidate', '360']
  };

  constructor(private candidateService: CandidateService) {}

  async validate(input: any): Promise<ValidationResult> {
    if (!input.candidateId) return { valid: false, errors: ['candidateId is required'] };
    return { valid: true };
  }

  async authorize(context: ToolContext): Promise<AuthorizationResult> {
    return { authorized: true };
  }

  async execute(input: any, context: ToolContext) {
    return this.candidateService.get360Summary(input.candidateId);
  }

  async audit(execution: ToolExecution) {}
  async telemetry(execution: ToolExecution) {}
}
