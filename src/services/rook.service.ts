import axios from "axios";

/**
 * ROOK Health API Service
 * Handles integration with ROOK Connect API for wearable data
 */

const ROOK_BASE_URL =
  process.env.ROOK_SANDBOX_BASE_URL || "https://api.rook-connect.review";
const ROOK_CLIENT_UUID = process.env.ROOK_SANDBOX_CLIENT_UUID || "";
const ROOK_SECRET_KEY = process.env.ROOK_SANDBOX_SECRET_KEY || "";

console.log("🔧 ROOK Service Configuration:", {
  baseUrl: ROOK_BASE_URL,
  clientUuid: ROOK_CLIENT_UUID
    ? `${ROOK_CLIENT_UUID.substring(0, 8)}...`
    : "NOT SET",
  secretKey: ROOK_SECRET_KEY ? "SET" : "NOT SET",
});

interface RookConnectionStatus {
  userId: string;
  connections: {
    [key: string]: {
      connected: boolean;
      dataSource: string;
      lastSync?: string;
    };
  };
}

/**
 * Get all wearable connections for a user from ROOK
 * Checks each data source individually via authorizer endpoint
 */
export const getUserConnections = async (
  userId: string,
): Promise<RookConnectionStatus> => {
  try {
    console.log(`🔍 Fetching ROOK connections for user: ${userId}`);

    const dataSources = ["oura", "garmin", "fitbit", "whoop", "polar"];
    const connections: any = {};

    // Check each data source individually
    for (const dataSource of dataSources) {
      try {
        const response = await axios.get(
          `${ROOK_BASE_URL}/api/v1/user_id/${userId}/data_source/${dataSource}/authorizer`,
          {
            headers: {
              "User-Agent": "H2Oasis/1.0.0",
              Authorization: `Basic ${Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString("base64")}`,
              Accept: "application/json",
            },
          },
        );

        connections[dataSource] = {
          connected: response.data.authorized === true,
          lastSync: new Date(),
        };

        console.log(
          `✅ ${dataSource}: ${response.data.authorized === true ? "Connected" : "Not connected"}`,
        );
      } catch (error: any) {
        console.log(`ℹ️ ${dataSource}: Not connected or error checking`);
        connections[dataSource] = {
          connected: false,
          lastSync: new Date(),
        };
      }
    }

    return { userId, connections };
  } catch (error: any) {
    console.error(
      "❌ Error fetching ROOK connections:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Get sleep health data from ROOK
 * API: GET /v2/processed_data/sleep_health/summary
 */
export const getSleepHealthData = async (
  userId: string,
  dataSource: string,
  date?: string,
): Promise<any> => {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    console.log(
      `😴 Fetching sleep data from ${dataSource} for user: ${userId} on ${targetDate}`,
    );

    const endpoint = `${ROOK_BASE_URL}/v2/processed_data/sleep_health/summary`;
    console.log(`📡 Calling: ${endpoint}`);

    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      params: {
        user_id: userId,
        data_source: dataSource,
        date: targetDate,
      },
    });

    console.log(
      `✅ Sleep data fetched:`,
      JSON.stringify(response.data, null, 2),
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(
        `ℹ️ No sleep data available for ${dataSource} on ${date || "today"}`,
      );
      return null;
    }
    console.error(`❌ Error fetching sleep data:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return null;
  }
};

/**
 * Get physical health data from ROOK
 * API: GET /v2/processed_data/physical_health/summary
 */
export const getPhysicalHealthData = async (
  userId: string,
  dataSource: string,
  date?: string,
): Promise<any> => {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    console.log(
      `🏃 Fetching physical data from ${dataSource} for user: ${userId} on ${targetDate}`,
    );

    const endpoint = `${ROOK_BASE_URL}/v2/processed_data/physical_health/summary`;
    console.log(`� Calling: ${endpoint}`);

    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      params: {
        user_id: userId,
        data_source: dataSource,
        date: targetDate,
      },
    });

    console.log(
      `✅ Physical data fetched:`,
      JSON.stringify(response.data, null, 2),
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(
        `ℹ️ No physical data available for ${dataSource} on ${date || "today"}`,
      );
      return null;
    }
    console.error(`❌ Error fetching physical data:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return null;
  }
};

/**
 * Get body health data from ROOK
 * API: GET /v2/processed_data/body_health/summary
 */
export const getBodyHealthData = async (
  userId: string,
  dataSource: string,
  date?: string,
): Promise<any> => {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0];
    console.log(
      `⚖️ Fetching body data from ${dataSource} for user: ${userId} on ${targetDate}`,
    );

    const endpoint = `${ROOK_BASE_URL}/v2/processed_data/body_health/summary`;
    console.log(`📡 Calling: ${endpoint}`);

    const response = await axios.get(endpoint, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      params: {
        user_id: userId,
        data_source: dataSource,
        date: targetDate,
      },
    });

    console.log(
      `✅ Body data fetched:`,
      JSON.stringify(response.data, null, 2),
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(
        `ℹ️ No body data available for ${dataSource} on ${date || "today"}`,
      );
      return null;
    }
    console.error(`❌ Error fetching body data:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return null;
  }
};

/**
 * Check if a specific data source is connected for a user
 */
export const checkDataSourceConnection = async (
  userId: string,
  dataSource: string,
): Promise<boolean> => {
  try {
    const connections = await getUserConnections(userId);
    return connections.connections?.[dataSource]?.connected || false;
  } catch (error) {
    console.error(`Error checking ${dataSource} connection:`, error);
    return false;
  }
};

/**
 * Get available data sources from ROOK
 */
export const getAvailableDataSources = async (): Promise<string[]> => {
  try {
    const response = await axios.get(`${ROOK_BASE_URL}/v1/data-sources`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${ROOK_CLIENT_UUID}:${ROOK_SECRET_KEY}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
    });

    return response.data.data_sources || [];
  } catch (error: any) {
    console.error(
      "❌ Error fetching data sources:",
      error.response?.data || error.message,
    );
    return [];
  }
};

/**
 * Fetch all available health data for a user from a specific data source
 */
export const getAllHealthDataForSource = async (
  userId: string,
  dataSource: string,
  date?: string,
): Promise<{
  sleep: any;
  physical: any;
  body: any;
}> => {
  console.log(`📊 Fetching all health data for ${dataSource}...`);

  const results = {
    sleep: null,
    physical: null,
    body: null,
  };

  // Fetch sleep data
  results.sleep = await getSleepHealthData(userId, dataSource, date);

  // Fetch physical/activity data
  results.physical = await getPhysicalHealthData(userId, dataSource, date);

  // Fetch body data
  results.body = await getBodyHealthData(userId, dataSource, date);

  console.log(`✅ Health data fetch complete for ${dataSource}`);
  return results;
};
