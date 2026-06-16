import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ReturnsPage from "@/app/returns/page";

// Mock Next.js Navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock Firebase auth-context
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { getIdToken: vi.fn().mockResolvedValue("mock-token") },
    userData: { role: "account_admin", isAdmin: false },
    loading: false,
  }),
}));

// Mock UI context
vi.mock("@/lib/ui-context", () => ({
  useUI: () => ({
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
  }),
}));

// Mock Firestore operations
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

// Mock Firebase initialization
vi.mock("@/lib/firebase", () => ({
  db: {},
  auth: {},
}));

// Mock next/image to prevent rendering optimization issues in tests
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || "mocked image"} />;
  },
}));

describe("Task 1: Componente de Busca UI (Input Group)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock global fetch to handle the fetchReturns call on page load
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ returns: [] }),
    });
  });

  describe("Cenário 1.1: Exibição padrão do componente", () => {
    it("deve exibir o campo de busca rápida permanentemente com o select configurado para 'Todos' e o input de texto vazio", async () => {
      render(<ReturnsPage />);

      // Wait for the async loading of returns to complete
      await screen.findByText("Nenhuma devolução cadastrada");

      // Verify that the search type dropdown select is visible and defaults to 'Todos' ('all')
      const selectDropdown = screen.getByRole("combobox", {
        name: /tipo de busca|campo de busca/i,
      });
      expect(selectDropdown).toBeInTheDocument();
      expect(selectDropdown).toHaveValue("all");

      // Verify that the search text input is visible and empty
      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveValue("");

      // Verify that the clear search button ('X') is not initially rendered
      const clearButton = screen.queryByRole("button", {
        name: /limpar busca/i,
      });
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  describe("Cenário 1.2: Ação de limpar busca", () => {
    it("deve limpar o input de busca rápida e ocultar o botão 'X' ao clicar nele", async () => {
      render(<ReturnsPage />);

      // Wait for the async loading of returns to complete
      await screen.findByText("Nenhuma devolução cadastrada");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      // Simulate typing a search query
      act(() => {
        fireEvent.change(searchInput, { target: { value: "QM1234" } });
      });
      expect(searchInput).toHaveValue("QM1234");

      // Verify that the clear button ('X') is now rendered
      const clearButton = screen.getByRole("button", {
        name: /limpar busca/i,
      });
      expect(clearButton).toBeInTheDocument();

      // Click the clear button
      act(() => {
        fireEvent.click(clearButton);
      });

      // Verify that the search input value is cleared and the clear button is removed
      expect(searchInput).toHaveValue("");
      expect(clearButton).not.toBeInTheDocument();
    });
  });
});
