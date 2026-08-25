import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { FirebaseEventService } from './FirebaseEventService';
import { RequirementInput } from '../../../types/Requirement';
import { Candidate } from '../../../types.ts';

export interface IntakeEvent {
  source: 'EMAIL' | 'PORTAL' | 'API';
  type: 'REQUIREMENT' | 'CANDIDATE' | 'SUBMISSION';
  payload: any;
  orgId: string;
  correlationId: string;
}

export class FirebaseIntakeService {
  private static instance: FirebaseIntakeService;
  private eventService: FirebaseEventService;

  private constructor() {
    this.eventService = new FirebaseEventService();
  }

  public static getInstance(): FirebaseIntakeService {
    if (!FirebaseIntakeService.instance) {
      FirebaseIntakeService.instance = new FirebaseIntakeService();
    }
    return FirebaseIntakeService.instance;
  }

  /**
   * Main entry point for any intake operation.
   * Processes the raw intake, creates entities, and emits INTAKE_COMPLETED.
   */
  async processIntake(event: IntakeEvent): Promise<{ success: boolean; entityId?: string }> {
    try {
      console.log(`[INTAKE SERVICE] Processing ${event.type} from ${event.source} for org ${event.orgId}`);

      let entityId = '';

      if (event.type === 'REQUIREMENT') {
        entityId = await this.handleRequirementIntake(event);
      } else if (event.type === 'CANDIDATE') {
        entityId = await this.handleCandidateIntake(event);
      }

      // Emit the Unified Event
      await this.eventService.emitEvent(
        'INTAKE_COMPLETED',
        event.type === 'REQUIREMENT' ? 'JOB' : 'CANDIDATE',
        entityId,
        'SYSTEM',
        'hq_admin',
        {
          source: event.source,
          orgId: event.orgId,
          correlationId: event.correlationId,
          timestamp: new Date().toISOString()
        }
      );

      return { success: true, entityId };
    } catch (error) {
      console.error(`[INTAKE SERVICE] Failed to process intake:`, error);
      return { success: false };
    }
  }

  private async handleRequirementIntake(event: IntakeEvent): Promise<string> {
    const rawJd = event.payload.jdText || event.payload.body;
    
    // In a real system, we'd call the /api/parse-jd here or use the logic directly.
    // For this milestone, we'll simulate the structured extraction or use existing data if provided.
    
    const mappedViaMap: Record<string, 'CRM' | 'OS' | 'PORTAL' | 'API' | 'IMPORT'> = {
      'EMAIL': 'IMPORT',
      'PORTAL': 'PORTAL',
      'API': 'API'
    };

    const requirementData: any = {
      clientId: event.orgId,
      title: event.payload.title || 'New Requirement',
      skills: event.payload.skills || [],
      budget: event.payload.budget || 'Market Rate',
      priority: event.payload.priority || 'Medium',
      status: 'active',
      submissions: [],
      jdText: rawJd,
      mandatorySkills: event.payload.mandatorySkills || [],
      location: event.payload.location || 'Remote',
      experienceRange: event.payload.experienceRange || '5+ Years',
      createdFrom: 'CLIENT',
      createdVia: mappedViaMap[event.source] || 'PORTAL',
      createdByRole: 'CLIENT'
    };

    const { doc, setDoc } = await import('firebase/firestore');
    const docRef = await addDoc(collection(db, "requirements_public"), {
      ...requirementData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Auto-create corresponding Deal Room
    try {
      await setDoc(doc(db, "dealRooms", `DR-${docRef.id}`), {
        id: `DR-${docRef.id}`,
        requirementId: docRef.id,
        requirementTitle: requirementData.title,
        clientId: requirementData.clientId,
        vendorId: "Direct",
        candidateId: "",
        candidateName: "Requirement Room",
        status: "active",
        createdAt: new Date().toISOString(),
        createdBy: "system",
        matchScore: 100,
        expectedFee: 0,
        isActive: true
      });
    } catch (e) {
      console.warn("Deal Room auto-creation deferred in intake:", e);
    }

    return docRef.id;
  }

  private async handleCandidateIntake(event: IntakeEvent): Promise<string> {
    const candidateData: Partial<Candidate> = {
      fullName: event.payload.name || 'New Candidate',
      primaryEmail: event.payload.email,
      skills: event.payload.skills || [],
      experience: event.payload.experience || 'Unparsed',
      createdBy: 'SYSTEM',
      sourceOrganizations: [event.orgId],
      canonicalProfile: true,
      visibilityScopes: ['GLOBAL'],
      yearsOfExperience: event.payload.yearsOfExperience || 0,
      currentRole: event.payload.currentRole || 'Professional',
      trustScore: 80,
      ownerType: 'SYSTEM',
      ownerId: 'SYSTEM',
      ownerName: 'SYSTEM',
      acquiredAt: new Date().toISOString(),
      acquisitionMethod: 'IMPORT'
    };

    const docRef = await addDoc(collection(db, "candidatePool"), {
      ...candidateData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return docRef.id;
  }
}
