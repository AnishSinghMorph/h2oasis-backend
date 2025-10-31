import { ISleepData, IPhysicalData, IBodyData, IActivityEvent, IRookWebhookPayload } from '../models/HealthData.types';
import { TransformerUtils } from '../utils/transformer.utils';

export class HealthDataTransformer {
  
  static transform(payload: IRookWebhookPayload) {
    const dataStructure = payload.data_structure;
    
    console.log('🔄 Transforming data structure:', dataStructure);
    
    switch (dataStructure) {
      case 'sleep_summary':
        return this.transformSleepSummary(payload);
      
      case 'physical_summary':
        return this.transformPhysicalSummary(payload);
      
      case 'body_summary':
        return this.transformBodySummary(payload);
      
      case 'activity_event':
        return this.transformActivityEvent(payload);
      
      case 'body_metrics_event':
        return this.transformBodyMetricsEvent(payload);
      
      default:
        console.warn('⚠️ Unknown data structure:', dataStructure);
        return null;
    }
  }
  
  static transformSleepSummary(payload: IRookWebhookPayload): ISleepData | null {
    const sleepSummary = payload.sleep_health?.summary?.sleep_summary;
    
    if (!sleepSummary) {
      console.warn('⚠️ No sleep_summary found in payload');
      return null;
    }
    
    const cleanData = TransformerUtils.transformSleepSummary(sleepSummary);
    console.log('✅ Sleep data transformed:', cleanData ? Object.keys(cleanData) : 'empty');
    return cleanData;
  }
  
  static transformPhysicalSummary(payload: IRookWebhookPayload): IPhysicalData | null {
    const physicalSummary = payload.physical_health?.summary?.physical_summary;
    
    if (!physicalSummary) {
      console.warn('⚠️ No physical_summary found in payload');
      return null;
    }
    
    const cleanData = TransformerUtils.transformPhysicalSummary(physicalSummary);
    console.log('✅ Physical data transformed:', cleanData ? Object.keys(cleanData) : 'empty');
    return cleanData;
  }
  
  static transformBodySummary(payload: IRookWebhookPayload): IBodyData | null {
    const bodySummary = payload.body_health?.summary?.body_summary;
    
    if (!bodySummary) {
      console.warn('⚠️ No body_summary found in payload');
      return null;
    }
    
    const cleanData = TransformerUtils.transformBodySummary(bodySummary);
    console.log('✅ Body data transformed:', cleanData ? Object.keys(cleanData) : 'empty');
    return cleanData;
  }
  
  static transformActivityEvent(payload: IRookWebhookPayload): IActivityEvent[] | null {
    const activityEvents = payload.physical_health?.events?.activity_event;
    
    if (!activityEvents || !Array.isArray(activityEvents)) {
      console.warn('⚠️ No activity_event found in payload');
      return null;
    }
    
    const cleanEvents = TransformerUtils.transformActivityEvent(activityEvents);
    console.log(`✅ Transformed ${cleanEvents?.length || 0} activity event(s)`);
    return cleanEvents;
  }
  
  static transformBodyMetricsEvent(payload: IRookWebhookPayload): IBodyData | null {
    const bodyMetricsEvents = payload.body_health?.events?.body_metrics_event;
    
    if (!bodyMetricsEvents || !Array.isArray(bodyMetricsEvents) || bodyMetricsEvents.length === 0) {
      console.warn('⚠️ No body_metrics_event found in payload');
      return null;
    }
    
    const cleanData = TransformerUtils.transformBodyMetricsEvent(bodyMetricsEvents);
    console.log('✅ Body metrics event transformed:', cleanData ? Object.keys(cleanData) : 'empty');
    return cleanData;
  }
  
  static extractSource(payload: IRookWebhookPayload): string {
    return TransformerUtils.extractSource(payload);
  }
}

