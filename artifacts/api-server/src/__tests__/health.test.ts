import { describe, it, expect } from "vitest";
import { HealthCheckResponse } from "@workspace/api-zod";

describe("Health endpoint", () => {
  it("should validate a health check response", () => {
    const result = HealthCheckResponse.parse({ status: "ok" });
    expect(result).toEqual({ status: "ok" });
  });

  it("should accept any string status", () => {
    const result = HealthCheckResponse.parse({ status: "anything" });
    expect(result.status).toBe("anything");
  });

  it("should reject missing status field", () => {
    expect(() => HealthCheckResponse.parse({})).toThrow();
  });

  it("should reject non-string status", () => {
    expect(() => HealthCheckResponse.parse({ status: 123 })).toThrow();
  });
});
