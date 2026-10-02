import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const auth = vi.hoisted(() => ({
  user: null as null | { canClaimSuperAdmin?: boolean },
  login: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import SuperAdminClaimCard from "@/components/SuperAdminClaimCard";

describe("SuperAdminClaimCard (Parte A1)", () => {
  beforeEach(() => {
    auth.user = null;
  });

  it("no se muestra si el usuario no puede reclamar el rol", () => {
    auth.user = { canClaimSuperAdmin: false };
    const { container } = render(<SuperAdminClaimCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("se muestra para la cuenta del superadministrador", () => {
    auth.user = { canClaimSuperAdmin: true };
    render(<SuperAdminClaimCard />);
    expect(
      screen.getByText(/Activar como superadministrador/i),
    ).toBeInTheDocument();
  });
});
