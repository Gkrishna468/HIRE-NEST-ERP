import { 
  MCPTool, 
  MCPToolManifest, 
  ToolContext, 
  ValidationResult, 
  AuthorizationResult, 
  ToolExecution 
} from '@hirenest/platform-sdk';

export interface CandidateSearchInput {
  skills?: string[];
  location?: string;
  minExperience?: number;
}

export interface CandidateSearchOutput {
  candidates: Array<{
    id: string;
    name: string;
    matchScore: number;
  }>;
}

/**
 * Reference implementation of an MCP Tool.
 * Follows the Golden Path Execution Lifecycle.
 */
export class CandidateSearchTool implements MCPTool<CandidateSearchInput, CandidateSearchOutput> {
  
  readonly manifest: MCPToolManifest = {
    id: 'candidate.search',
    name: 'Candidate Search',
    version: '1.0.0',
    domain: 'Candidate',
    owner: 'Platform Team',
    description: 'Searches for candidates based on skills, location, and experience',
    permissions: ['candidate:read'],
    capabilities: ['search'],
    auditLevel: 'HIGH',
    timeout: '5s',
    retryPolicy: 'default',
    visibility: 'internal',
    status: 'Production',
    tags: ['search', 'candidate']
  };

  async validate(input: CandidateSearchInput): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!input.skills && !input.location && input.minExperience === undefined) {
      errors.push('Must provide at least one search criteria');
    }
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async authorize(context: ToolContext): Promise<AuthorizationResult> {
    // Domain-specific Authorization (e.g. data isolation checks)
    // The Policy Engine already checked if the user can execute this tool.
    return { authorized: true };
  }

  async execute(input: CandidateSearchInput, context: ToolContext): Promise<CandidateSearchOutput> {
    // 1. Initialize Tracing/Logger (Optional)
    // 2. Fetch Data via Business Service / Repository
    // 3. Return results
    
    // Example Mock Response
    return {
      candidates: [
        { id: 'c-1', name: 'Alice Smith', matchScore: 95 },
        { id: 'c-2', name: 'Bob Jones', matchScore: 88 }
      ]
    };
  }

  async audit(execution: ToolExecution<CandidateSearchInput, CandidateSearchOutput>): Promise<void> {
    // E.g. Save search parameters to a specific Search History collection
  }

  async telemetry(execution: ToolExecution<CandidateSearchInput, CandidateSearchOutput>): Promise<void> {
    // E.g. Record the number of results returned or cache hit rates
  }
}
