import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { IRequirementService } from '../contracts/IRequirementService';
import { Requirement, RequirementInput, RequirementUpdate } from '../../../types/Requirement';

export class FirebaseRequirementService implements IRequirementService {
  private collectionName = 'requirements_public';

  async getRequirement(id: string): Promise<Requirement | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Requirement;
    }
    return null;
  }

  async createRequirement(data: RequirementInput): Promise<Requirement> {
    const docRef = doc(collection(db, this.collectionName));
    const reqId = docRef.id;
    
    // Default Provenance and status fields if not provided
    const status = (data.status || 'ACTIVE').toUpperCase();
    const newDoc = { 
      ...data,
      status,
      source: data.source || 'CLIENT_OS',
      sourceType: 'PORTAL',
      createdFrom: data.createdFrom || 'CLIENT',
      createdVia: data.createdVia || 'OS',
      createdByRole: data.createdByRole || 'RECRUITER',
      isFallbackPreview: false,
      syncStatus: 'DIRECT_ENTRY',
      whatsappQueueStatus: status === 'ACTIVE' ? 'PENDING_PUBLICATION_1' : 'INACTIVE',
      whatsappPubHistory: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(docRef, newDoc);

    // Auto-create corresponding Deal Room: Requirement 1 -> 1 Deal Room
    try {
      await setDoc(doc(db, "dealRooms", `DR-${reqId}`), {
        id: `DR-${reqId}`,
        requirementId: reqId,
        requirementTitle: data.title || 'Requirement Room',
        clientId: data.clientId || "default-client-org",
        vendorId: "Direct",
        candidateId: "",
        candidateName: "Requirement Room",
        status: status === 'ACTIVE' ? "active" : "inactive",
        createdAt: new Date().toISOString(),
        createdBy: "system",
        matchScore: 100,
        expectedFee: 0,
        isActive: status === 'ACTIVE'
      });
    } catch (e) {
      console.warn("Deal Room auto-creation deferred in service:", e);
    }

    return { id: reqId, ...newDoc } as unknown as Requirement;
  }

  async updateRequirement(id: string, updates: RequirementUpdate): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    } as { [x: string]: any });
  }

  async archiveRequirement(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, { 
      status: 'archived',
      updatedAt: serverTimestamp()
    });
  }
}

