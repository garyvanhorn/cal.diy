import { describe, expect, it, vi } from "vitest";

vi.mock("@calcom/lib/constants", () => ({
  COMPANY_NAME: "GVX Digital",
  SUPPORT_MAIL_ADDRESS: "support@cronslot.com",
  WEBSITE_URL: "https://cronslot.com",
}));

import { withInstanceBranding } from "../withInstanceBranding";

describe("withInstanceBranding", () => {
  it("replaces upstream publisher, email and url with the instance's own", () => {
    const result = withInstanceBranding({
      slug: "zoom",
      publisher: "Cal.com, Inc.",
      email: "help@cal.com",
      url: "https://cal.com/",
    });

    expect(result).toEqual({
      slug: "zoom",
      publisher: "GVX Digital",
      email: "support@cronslot.com",
      url: "https://cronslot.com",
    });
  });

  it("handles the Cal.diy publisher and support@cal.com variants", () => {
    const result = withInstanceBranding({
      publisher: "Cal.diy",
      email: "support@cal.com",
      url: "https://cal.com",
    });

    expect(result.publisher).toBe("GVX Digital");
    expect(result.email).toBe("support@cronslot.com");
    expect(result.url).toBe("https://cronslot.com");
  });

  it("keeps third-party publisher details", () => {
    const meta = { publisher: "Riverside", email: "help@riverside.fm", url: "https://riverside.fm" };

    expect(withInstanceBranding(meta)).toEqual(meta);
  });

  it("does not treat lookalike domains as upstream", () => {
    const meta = { url: "https://monobot.ai/?ref=cal.com", email: "team@notcal.com" };

    expect(withInstanceBranding(meta)).toEqual(meta);
  });

  it("leaves missing fields undefined", () => {
    expect(withInstanceBranding({})).toEqual({ publisher: undefined, email: undefined, url: undefined });
  });
});
