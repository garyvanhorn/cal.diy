import { appKeysSchemas } from "@calcom/app-store/apps.keys-schemas.generated";
import { describe, expect, it } from "vitest";
import { getAppKeysSchema } from "./getAppKeysSchema";

describe("getAppKeysSchema", () => {
  it("finds the Stripe schema from its dir name", () => {
    const schema = getAppKeysSchema("stripepayment");

    expect(schema).toBe(appKeysSchemas.stripe);
    expect(Object.keys(schema.shape)).toEqual(["client_id", "client_secret", "public_key", "webhook_secret"]);
  });

  it("finds apps whose dir name is their id", () => {
    expect(getAppKeysSchema("googlecalendar")).toBe(appKeysSchemas.googlecalendar);
  });

  it("returns undefined for apps without keys", () => {
    expect(getAppKeysSchema("not-a-real-app")).toBeUndefined();
  });
});
