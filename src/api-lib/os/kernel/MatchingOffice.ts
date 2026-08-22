import { BaseAIOffice } from "./BaseAIOffice.js";
import { MatchingOffice as LegacyMatchingOffice } from "../../services/MatchingOffice.js";
import { db } from "../../../lib/firebase-admin.js";
import {
  BusinessEvent,
  OfficeExecutionResult,
  OfficePolicy,
} from "./RuntimeTypes.js";

export class MatchingOffice extends BaseAIOffice {
  readonly name = "MatchingOffice";

  readonly policy: OfficePolicy = {
    supportedEvents: [
      "REQUIREMENT_CREATED",
      "REQUIREMENT_UPDATED",
      "REQUIREMENT_CLOSED",
      "CANDIDATE_CREATED",
      "CANDIDATE_UPDATED",
      "CANDIDATE_WITHDRAWN",
    ],
    priority: "HIGH",
    concurrency: 5,
    maximumRuntimeMs: 60000,
    dependencies: [],
    maxRetries: 3,
    retryDelayMs: 5000,
    backoffMultiplier: 2,
    maximumDelayMs: 60000,
    retryableErrorTypes: ["timeout", "network_error", "quota_exceeded"],
    permanentErrorTypes: ["validation_error", "not_found"],
    healthCheckIntervalMs: 60000,
    heartbeatIntervalMs: 15000,
  };

  protected async decisionEngine(
    event: BusinessEvent,
    memory: any,
  ): Promise<boolean> {
    // Matching Office computes matching for any of its supported events.
    return this.policy.supportedEvents.includes(event.eventType);
  }

  protected async execute(
    event: BusinessEvent,
    memory: any,
  ): Promise<OfficeExecutionResult> {
    await LegacyMatchingOffice.handleEvent(
      event.eventType,
      event.payload,
      event.tenantId,
    );
    return {
      success: true,
      actionTaken: "Processed Match",
      tokensUsed: 1500,
      model: "gemini-3.6-flash",
    };
  }
}
