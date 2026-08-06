import { EventDispatcher } from './EventDispatcher';
import { EventHandlerRegistry } from './EventHandlerRegistry';
import { SubmissionEventHandler } from './handlers/SubmissionEventHandler';
import { InterviewEventHandler } from './handlers/InterviewEventHandler';
import { OfferEventHandler } from './handlers/OfferEventHandler';
import { VendorEventHandler } from './handlers/VendorEventHandler';
import { AnalyticsEventHandler } from './handlers/AnalyticsEventHandler';
import { IntelligenceEventHandler } from './handlers/IntelligenceEventHandler';
import { ServerEventForwarder } from './handlers/ServerEventForwarder';
import { SystemEventListener } from '../integrations/events/SystemEventListener';

export function initializeEventBus() {
  const eventBus = EventDispatcher.getInstance();
  const registry = EventHandlerRegistry.getInstance();

  registry.registerHandler(eventBus, new SubmissionEventHandler());
  registry.registerHandler(eventBus, new InterviewEventHandler());
  registry.registerHandler(eventBus, new OfferEventHandler());
  registry.registerHandler(eventBus, new VendorEventHandler());
  registry.registerHandler(eventBus, new AnalyticsEventHandler());
  registry.registerHandler(eventBus, new IntelligenceEventHandler());
  registry.registerHandler(eventBus, new ServerEventForwarder());

  SystemEventListener.initialize();

  console.log('[EventBus] All core event handlers initialized.');
}
