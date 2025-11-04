import {
  ISleepData,
  IPhysicalData,
  IBodyData,
  IActivityEvent,
  IHealthData,
} from "../models/HealthData.types";
import { MergerUtils } from "../utils/merger.utils";

export class HealthDataMerger {
  static mergeHealthData(
    existingData: IHealthData | undefined,
    newData: ISleepData | IPhysicalData | IBodyData | IActivityEvent[] | null,
    dataType: "sleep" | "physical" | "body" | "activity_events",
  ): IHealthData {
    const currentData: IHealthData = existingData || {};

    if (!newData) {
      console.log("⏭️ No new data to merge");
      return currentData;
    }

    console.log(`🔀 Merging ${dataType} data`);

    switch (dataType) {
      case "sleep":
        currentData.sleep = MergerUtils.mergeSleepData(
          currentData.sleep,
          newData as ISleepData,
        );
        break;

      case "physical":
        currentData.physical = MergerUtils.mergePhysicalData(
          currentData.physical,
          newData as IPhysicalData,
        );
        break;

      case "body":
        currentData.body = MergerUtils.mergeBodyData(
          currentData.body,
          newData as IBodyData,
        );
        break;

      case "activity_events":
        currentData.activity_events = MergerUtils.mergeActivityEvents(
          currentData.activity_events,
          newData as IActivityEvent[],
        );
        break;
    }

    return currentData;
  }

  static getDataType(
    dataStructure: string,
  ): "sleep" | "physical" | "body" | "activity_events" | null {
    switch (dataStructure) {
      case "sleep_summary":
        return "sleep";

      case "physical_summary":
        return "physical";

      case "body_summary":
      case "body_metrics_event":
        return "body";

      case "activity_event":
        return "activity_events";

      default:
        console.warn("⚠️ Unknown data_structure:", dataStructure);
        return null;
    }
  }

  static mapSourceToWearable(source: string): string {
    const sourceMap: { [key: string]: string } = {
      fitbit: "fitbit",
      garmin: "garmin",
      oura: "oura",
      whoop: "whoop",
      "apple health": "apple",
      apple: "apple",
      "samsung health": "samsung",
      samsung: "samsung",
      polar: "polar",
    };

    const key = source.toLowerCase();
    return sourceMap[key] || "unknown";
  }
}
