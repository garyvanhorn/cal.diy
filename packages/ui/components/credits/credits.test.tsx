/* eslint-disable playwright/missing-playwright-await */
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import Credits from "./Credits";

vi.mock("@calcom/lib/constants", async () => {
  const actual = (await vi.importActual("@calcom/lib/constants")) as typeof import("@calcom/lib/constants");
  return {
    ...actual,
    CALCOM_VERSION: "mockedVersion",
    COMPANY_NAME: "GVX Digital",
  };
});

describe("Tests for Credits component", () => {
  test("Should render company name and version without upstream links", () => {
    render(<Credits />);

    expect(screen.getByText(/GVX Digital/)).toBeInTheDocument();
    expect(screen.getByText(/mockedVersion/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /GVX Digital/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /mockedVersion/ })).not.toBeInTheDocument();
  });

  test("Should render credits section with correct text", () => {
    render(<Credits />);

    const currentYear = new Date().getFullYear();
    const copyrightElement = screen.getByText(new RegExp(`© ${currentYear}`));
    expect(copyrightElement).toHaveTextContent(`${currentYear}`);
  });
});
