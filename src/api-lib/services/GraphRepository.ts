import { db } from '../../lib/firebase-admin.js';
import { BusinessGraphService, GraphNode, NodeType, GraphEdge } from './BusinessGraphService.js';

/**
 * GraphRepository provides a domain-specific API on top of the BusinessGraphService.
 */
export class GraphRepository {
    // Standard getters mapping to BusinessGraphService
    static async getNode(id: string): Promise<GraphNode | null> {
        return await BusinessGraphService.getNode(id);
    }

    static async getNeighbors(id: string, type?: string): Promise<GraphNode[]> {
        return await BusinessGraphService.getNeighbors(id, type);
    }

    static async addEdge(sourceId: string, targetId: string, type: string, metadata?: any, tenantId?: string): Promise<void> {
        await BusinessGraphService.addEdge(sourceId, targetId, type, metadata, tenantId);
    }

    static async transitionState(nodeId: string, newState: string, reason: string, actorId: string): Promise<void> {
        await BusinessGraphService.transitionState(nodeId, newState, reason, actorId);
    }

    static async findCandidateByEmail(tenantId: string, email: string): Promise<GraphNode | null> {
        const results = await BusinessGraphService.findByMetadata(tenantId, 'CANDIDATE', 'email', email);
        return results.length > 0 ? results[0] : null;
    }

    static async findRequirementByTitle(tenantId: string, title: string): Promise<GraphNode | null> {
        const results = await BusinessGraphService.findByMetadata(tenantId, 'REQUIREMENT', 'title', title);
        return results.length > 0 ? results[0] : null;
    }

    static async findVendorByEmail(tenantId: string, email: string): Promise<GraphNode | null> {
        if (!email) return null;
        const results = await BusinessGraphService.findByMetadata(tenantId, 'VENDOR', 'contactEmail', email);
        return results.length > 0 ? results[0] : null;
    }

    static async createCandidate(tenantId: string, data: any, actorId: string, owner?: string): Promise<GraphNode> {
        const existing = await this.findCandidateByEmail(tenantId, data.email);
        if (existing) return existing;

        return await BusinessGraphService.createNode('CANDIDATE', tenantId, data, actorId, owner);
    }

    static async createRequirement(tenantId: string, data: any, actorId: string, owner?: string): Promise<GraphNode> {
        const existing = await this.findRequirementByTitle(tenantId, data.title);
        if (existing) return existing;

        return await BusinessGraphService.createNode('REQUIREMENT', tenantId, data, actorId, owner);
    }

    static async createVendor(tenantId: string, data: any, actorId: string, owner?: string): Promise<GraphNode> {
        const existing = await this.findVendorByEmail(tenantId, data.contactEmail);
        if (existing) return existing;

        return await BusinessGraphService.createNode('VENDOR', tenantId, data, actorId, owner);
    }

    static async linkCandidateToRequirement(candidateId: string, requirementId: string, metadata: any, actorId: string): Promise<void> {
        const score = metadata?.score || 85;
        const confidence = metadata?.confidence || 0.9;
        const version = metadata?.version || 1;
        const source = metadata?.source || 'Direct Apply';

        await BusinessGraphService.addRelationship(candidateId, requirementId, 'SUBMITTED_TO', {
            score,
            confidence,
            version,
            source,
            createdAt: new Date().toISOString()
        });
        await BusinessGraphService.transitionState(candidateId, 'SUBMITTED', 'Applied to requirement', actorId);
    }

    static async getNodesByType(tenantId: string, type: NodeType, status?: string): Promise<GraphNode[]> {
        const query = db.collection('business_graph')
            .where('tenantId', '==', tenantId)
            .where('type', '==', type);
        
        const snapshot = status ? await query.where('state', '==', status).get() : await query.get();
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data?.type,
                tenantId: data?.tenantId || data?.orgId || tenantId,
                orgId: data?.orgId || data?.tenantId || tenantId,
                state: data?.state || 'NEW',
                owner: data?.owner || data?.ownerId,
                ownerId: data?.ownerId || data?.owner,
                metadata: data?.metadata || {},
                metrics: data?.metrics || {},
                timeline: data?.timeline || data?.history || [],
                history: data?.history || data?.timeline || [],
                policies: data?.policies || {},
                permissions: data?.permissions || {},
                experience: data?.experience || {},
                derivedIntelligence: data?.derivedIntelligence || {},
                version: data?.version || 1,
                relationships: data?.relationships || [],
                createdAt: data?.createdAt || new Date().toISOString(),
                updatedAt: data?.updatedAt || new Date().toISOString(),
            } as GraphNode;
        });
    }
}
