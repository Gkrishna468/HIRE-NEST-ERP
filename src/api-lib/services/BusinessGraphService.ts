import { db } from '../../lib/firebase-admin.js';
import { EnterpriseRuntimeKernel } from '../os/kernel/EnterpriseRuntimeKernel.js';

export type NodeType = 'WORKSPACE' | 'CLIENT' | 'VENDOR' | 'REQUIREMENT' | 'CANDIDATE' | 'SUBMISSION' | 'INTERVIEW' | 'OFFER' | 'PLACEMENT' | 'INVOICE' | 'USER' | 'FINANCE';

export interface GraphEvent {
    type: string;
    payload: any;
    timestamp: string;
    actorId: string;
}

export interface GraphRelationship {
    targetId: string;
    type: string;
    metadata?: Record<string, any>;
}

export interface GraphNode {
    id: string;
    type: NodeType;
    tenantId: string; // SSOT field
    orgId: string; // Backward compatibility alias
    state: string;
    owner?: string; // SSOT field
    ownerId?: string; // Backward compatibility alias
    metadata: Record<string, any>;
    metrics?: Record<string, any>;
    timeline?: GraphEvent[]; // SSOT field
    history?: GraphEvent[]; // Backward compatibility alias
    policies?: Record<string, any>;
    permissions?: Record<string, any>;
    experience?: Record<string, any>;
    derivedIntelligence?: Record<string, any>;
    version: number;
    relationships: GraphRelationship[];
    createdAt: string;
    updatedAt: string;
}

export type BusinessGraphNode = GraphNode;

export interface GraphEdge {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    tenantId: string;
    metadata: {
        score?: number;
        version?: number;
        source?: string;
        confidence?: number;
        createdAt: string;
        [key: string]: any;
    };
}

/**
 * GraphCache maintains a fast denormalized graph representation in-memory to optimize traversals.
 */
export class GraphCache {
    private static nodeCache = new Map<string, { node: GraphNode; expiresAt: number }>();
    private static neighborsCache = new Map<string, { neighbors: GraphNode[]; expiresAt: number }>();
    private static TTL = 60000; // 60 seconds

    static setNode(nodeId: string, node: GraphNode): void {
        this.nodeCache.set(nodeId, {
            node,
            expiresAt: Date.now() + this.TTL
        });
    }

    static getNode(nodeId: string): GraphNode | null {
        const entry = this.nodeCache.get(nodeId);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.nodeCache.delete(nodeId);
            return null;
        }
        return entry.node;
    }

    static invalidateNode(nodeId: string): void {
        this.nodeCache.delete(nodeId);
        this.neighborsCache.clear(); // Safe full neighbor invalidation on node update
    }

    static setNeighbors(nodeId: string, neighbors: GraphNode[]): void {
        this.neighborsCache.set(nodeId, {
            neighbors,
            expiresAt: Date.now() + this.TTL
        });
    }

    static getNeighbors(nodeId: string): GraphNode[] | null {
        const entry = this.neighborsCache.get(nodeId);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.neighborsCache.delete(nodeId);
            return null;
        }
        return entry.neighbors;
    }

    static clear(): void {
        this.nodeCache.clear();
        this.neighborsCache.clear();
    }
}

/**
 * BusinessGraphService is the Single Source of Truth for all business entities.
 * No Office or service should query Firestore directly for business objects.
 */
export class BusinessGraphService {
    private static COLLECTION_NODES = 'business_graph';
    private static COLLECTION_EDGES = 'graph_edges';

    static async getNode(id: string): Promise<GraphNode | null> {
        // 1. Try Cache First
        const cached = GraphCache.getNode(id);
        if (cached) return cached;

        // 2. Query Firestore
        const doc = await db.collection(this.COLLECTION_NODES).doc(id).get();
        if (!doc.exists) return null;

        const data = doc.data();
        // Construct canonical node ensuring backward compatibility
        const node: GraphNode = {
            id: data?.id || id,
            type: data?.type,
            tenantId: data?.tenantId || data?.orgId || 'GLOBAL',
            orgId: data?.orgId || data?.tenantId || 'GLOBAL',
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
        };

        // Cache the node
        GraphCache.setNode(id, node);
        return node;
    }

    static async createNode(type: NodeType, tenantId: string, metadata: any, actorId: string, owner?: string): Promise<GraphNode> {
        const id = `${type.toLowerCase()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        const initialEvent: GraphEvent = {
            type: 'CREATED',
            payload: metadata,
            timestamp: now,
            actorId
        };

        const node: GraphNode = {
            id,
            type,
            tenantId,
            orgId: tenantId,
            state: 'NEW',
            owner,
            ownerId: owner,
            metadata,
            metrics: {},
            timeline: [initialEvent],
            history: [initialEvent],
            policies: {},
            permissions: {},
            experience: {},
            derivedIntelligence: {},
            version: 1,
            relationships: [],
            createdAt: now,
            updatedAt: now
        };

        await db.collection(this.COLLECTION_NODES).doc(id).set(node);
        GraphCache.setNode(id, node);

        await EnterpriseRuntimeKernel.audit.logAction('NODE_CREATED', actorId, { nodeId: id, type });
        return node;
    }

    static async transitionState(nodeId: string, newState: string, reason: string, actorId: string): Promise<void> {
        const node = await this.getNode(nodeId);
        if (!node) throw new Error('Node not found');

        const success = await EnterpriseRuntimeKernel.state.transitionState(node.type, node.state, newState);
        if (!success) throw new Error(`Invalid state transition from ${node.state} to ${newState} for ${node.type}`);

        const now = new Date().toISOString();
        const transitionEvent: GraphEvent = {
            type: 'STATE_TRANSITION',
            payload: { from: node.state, to: newState, reason },
            timestamp: now,
            actorId
        };

        const updatedTimeline = [...(node.timeline || []), transitionEvent];
        const updatedVersion = (node.version || 1) + 1;

        await db.collection(this.COLLECTION_NODES).doc(nodeId).update({
            state: newState,
            timeline: updatedTimeline,
            history: updatedTimeline,
            version: updatedVersion,
            updatedAt: now
        });

        GraphCache.invalidateNode(nodeId);
        await EnterpriseRuntimeKernel.event.publish('STATE_CHANGED', { nodeId, newState, type: node.type });
    }

    private static async upsertBaselineNode(id: string, type: NodeType, tenantId: string = 'GLOBAL'): Promise<GraphNode> {
        const now = new Date().toISOString();
        const node: GraphNode = {
            id,
            type,
            tenantId,
            orgId: tenantId,
            state: 'NEW',
            metadata: { autoProvisioned: true },
            metrics: {},
            timeline: [],
            history: [],
            policies: {},
            permissions: {},
            experience: {},
            derivedIntelligence: {},
            version: 1,
            relationships: [],
            createdAt: now,
            updatedAt: now
        };
        await db.collection(this.COLLECTION_NODES).doc(id).set(node, { merge: true });
        GraphCache.setNode(id, node);
        return node;
    }

    static async addRelationship(sourceId: string, targetId: string, type: string, metadata?: any): Promise<void> {
        let source = await this.getNode(sourceId);
        if (!source) {
            const sourceType: NodeType = sourceId.toLowerCase().includes('cand') ? 'CANDIDATE' : (sourceId.toLowerCase().includes('req') ? 'REQUIREMENT' : 'CANDIDATE');
            source = await this.upsertBaselineNode(sourceId, sourceType, metadata?.tenantId || 'GLOBAL');
        }

        let target = await this.getNode(targetId);
        if (!target) {
            const targetType: NodeType = targetId.toLowerCase().includes('req') ? 'REQUIREMENT' : (targetId.toLowerCase().includes('cand') ? 'CANDIDATE' : 'REQUIREMENT');
            target = await this.upsertBaselineNode(targetId, targetType, metadata?.tenantId || 'GLOBAL');
        }

        const now = new Date().toISOString();

        // 1. Create first-class queryable Edge object
        const edgeId = `edge_${sourceId}_${targetId}_${type.toLowerCase()}`;
        const edge: GraphEdge = {
            id: edgeId,
            sourceId,
            targetId,
            type,
            tenantId: source.tenantId,
            metadata: {
                createdAt: now,
                ...metadata
            }
        };

        await db.collection(this.COLLECTION_EDGES).doc(edgeId).set(edge);

        // 2. Update inline relationships in the Source Node for fast local reads
        const updatedRelationships = [
            ...source.relationships,
            { targetId, type, metadata: edge.metadata }
        ];

        await db.collection(this.COLLECTION_NODES).doc(sourceId).update({
            relationships: updatedRelationships,
            updatedAt: now
        });

        GraphCache.invalidateNode(sourceId);
        GraphCache.invalidateNode(targetId);
    }

    // Explicitly support the graph API methods matching milestone requirements
    static async getNeighbors(nodeId: string, edgeType?: string): Promise<GraphNode[]> {
        const cached = GraphCache.getNeighbors(nodeId);
        if (cached) {
            return edgeType ? cached.filter(n => n.type === edgeType) : cached;
        }

        const node = await this.getNode(nodeId);
        if (!node) return [];

        const neighborIds = node.relationships
            .filter(r => !edgeType || r.type === edgeType)
            .map(r => r.targetId);

        if (neighborIds.length === 0) return [];

        // Fetch nodes of neighbors
        const neighbors: GraphNode[] = [];
        for (const id of neighborIds) {
            const n = await this.getNode(id);
            if (n) neighbors.push(n);
        }

        GraphCache.setNeighbors(nodeId, neighbors);
        return neighbors;
    }

    static async addEdge(sourceId: string, targetId: string, type: string, metadata?: any, tenantId?: string): Promise<void> {
        await this.addRelationship(sourceId, targetId, type, metadata);
    }

    static async publishEvent(type: string, payload: any): Promise<void> {
        await EnterpriseRuntimeKernel.event.publish(type, payload);
    }

    static async findByMetadata(tenantId: string, type: NodeType, key: string, value: any): Promise<GraphNode[]> {
        const snapshot = await db.collection(this.COLLECTION_NODES)
            .where('tenantId', '==', tenantId)
            .where('type', '==', type)
            .where(`metadata.${key}`, '==', value)
            .get();
        
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

    static async updateDerivedIntelligence(nodeId: string, derivedIntelligence: Record<string, any>): Promise<void> {
        const node = await this.getNode(nodeId);
        if (!node) throw new Error('Node not found');

        const now = new Date().toISOString();
        await db.collection(this.COLLECTION_NODES).doc(nodeId).update({
            derivedIntelligence: {
                ...(node.derivedIntelligence || {}),
                ...derivedIntelligence
            },
            updatedAt: now
        });

        GraphCache.invalidateNode(nodeId);
    }

    static async updateMetrics(nodeId: string, metrics: Record<string, any>): Promise<void> {
        const node = await this.getNode(nodeId);
        if (!node) throw new Error('Node not found');

        const now = new Date().toISOString();
        await db.collection(this.COLLECTION_NODES).doc(nodeId).update({
            metrics: {
                ...(node.metrics || {}),
                ...metrics
            },
            updatedAt: now
        });

        GraphCache.invalidateNode(nodeId);
    }
}
