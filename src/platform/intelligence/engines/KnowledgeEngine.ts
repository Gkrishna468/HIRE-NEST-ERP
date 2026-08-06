export interface KnowledgeQueryResult {
  domain: string;
  query: string;
  entities: Record<string, any>[];
  relationships: { subject: string; relation: string; object: string }[];
  confidence: number;
}

export interface KnowledgeEngine {
  queryKnowledgeGraph(domain: 'COMPANY' | 'SKILL' | 'RECRUITER' | 'VENDOR' | 'CANDIDATE' | 'REQUIREMENT', query: string): Promise<KnowledgeQueryResult>;
  getSemanticRelationships(entityId: string, entityType: string): Promise<Record<string, any>[]>;
}
