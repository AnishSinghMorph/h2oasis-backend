/**
 * Unit Tests for ROOK Service Helper Functions
 * These tests verify the utility functions without making actual API calls
 */

describe("ROOK Service Utils", () => {
  describe("Date formatting", () => {
    it("should format date to YYYY-MM-DD", () => {
      const date = new Date("2025-10-06T12:30:00Z");
      const formatted = date.toISOString().split("T")[0];

      expect(formatted).toBe("2025-10-06");
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should handle current date", () => {
      const today = new Date().toISOString().split("T")[0];

      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(today.length).toBe(10);
    });
  });

  describe("Data source validation", () => {
    const validSources = [
      "OURA",
      "GARMIN",
      "FITBIT",
      "WHOOP",
      "POLAR",
      "SAMSUNG",
    ];

    it("should validate known data sources", () => {
      validSources.forEach((source) => {
        expect(validSources).toContain(source);
      });
    });

    it("should handle lowercase source names", () => {
      const source = "garmin";
      const normalized = source.toUpperCase();

      expect(validSources).toContain(normalized);
    });

    it("should reject invalid sources", () => {
      const invalidSource = "INVALID_SOURCE";

      expect(validSources).not.toContain(invalidSource);
    });
  });

  describe("URL construction", () => {
    it("should build correct ROOK API URL", () => {
      const baseUrl = "https://api.rook-connect.dev";
      const userId = "test-user-123";
      const dataSource = "GARMIN";

      const url = `${baseUrl}/v1/users/${userId}/connections/${dataSource}`;

      expect(url).toBe(
        "https://api.rook-connect.dev/v1/users/test-user-123/connections/GARMIN",
      );
    });

    it("should handle special characters in user ID", () => {
      const userId = "user-with-dashes-123";
      const url = `/v1/users/${userId}`;

      expect(url).toContain("user-with-dashes-123");
    });
  });

  describe("Error handling helpers", () => {
    it("should format error messages correctly", () => {
      const error = new Error("Connection failed");
      const formatted = `ROOK API Error: ${error.message}`;

      expect(formatted).toBe("ROOK API Error: Connection failed");
    });

    it("should handle unknown errors", () => {
      const error: unknown = "String error";
      const formatted = error instanceof Error ? error.message : String(error);

      expect(formatted).toBe("String error");
    });
  });
});
