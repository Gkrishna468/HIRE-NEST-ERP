export interface MCPToolManifest {
  id: string;
  name: string;
  version: string;
  domain: string;
  owner: string;
  description: string;
  permissions: string[];
  capabilities: string[];
  auditLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  timeout: string;
  retryPolicy: string;
  visibility: 'internal' | 'public' | 'experimental' | 'deprecated';
  status: 'Draft' | 'Experimental' | 'Internal' | 'Production' | 'Deprecated' | 'Archived';
  tags: string[];
}
