import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
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
const mockShowAlert = vi.fn();
vi.mock("@/lib/ui-context", () => ({
  useUI: () => ({
    showAlert: mockShowAlert,
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
  default: (props: React.ComponentPropsWithoutRef<"img">) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || "mocked image"} />;
  },
}));

describe("Task 1: Componente de Busca UI (Input Group)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock global fetch to handle the fetchReturns call on page load with empty list by default
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

  describe("Cenário 1.3: Exibição de sugestões com base no termo digitado", () => {
    const mockReturns = [
      {
        id: "RET-001",
        orderNumber: "MLB3249081234",
        invoiceNumber: "10293",
        customerName: "Carlos Silva",
        channel: "meli",
        returnType: "full",
        status: "pending_analysis",
        trackingCode: "RE829304812BR",
        reverseTrackingCode: "RE829304812BR",
        returnDate: "2026-06-14",
      },
      {
        id: "RET-002",
        orderNumber: "SHP981726354",
        invoiceNumber: "09841",
        customerName: "Mariana Costa",
        channel: "shopee",
        returnType: "flex",
        status: "resolved",
        trackingCode: "QP102938475BR",
        reverseTrackingCode: "QP102938475BR",
        returnDate: "2026-06-11",
      }
    ];

    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes("/api/returns/RET-001")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ return: mockReturns[0], history: [] }),
          });
        }
        if (url.includes("/api/returns/RET-002")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ return: mockReturns[1], history: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ returns: mockReturns }),
        });
      });
    });

    it("deve mostrar sugestões de devoluções correspondentes ao digitar 2 ou mais caracteres (busca 'Todos')", async () => {
      render(<ReturnsPage />);

      // Wait for the data to load
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      // Simulate typing "Carlos" (matches Carlos Silva)
      act(() => {
        fireEvent.change(searchInput, { target: { value: "Carlos" } });
      });

      // Suggestions container should appear
      const suggestionsContainer = await screen.findByTestId("search-suggestions-container");
      expect(suggestionsContainer).toBeInTheDocument();

      // Suggestion item should appear inside container
      expect(within(suggestionsContainer).getByText(/Pedido: MLB3249081234/i)).toBeInTheDocument();
      expect(within(suggestionsContainer).getAllByText(/Carlos Silva/i).length).toBeGreaterThanOrEqual(1);

      // Verify second return is not in suggestions container (doesn't match "Carlos")
      expect(within(suggestionsContainer).queryByText(/Mariana Costa/i)).not.toBeInTheDocument();
    });

    it("deve filtrar sugestões baseado no parâmetro de busca selecionado (ex: buscar apenas por Pedido)", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const selectDropdown = screen.getByRole("combobox", { name: /tipo de busca|campo de busca/i });
      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      // Change parameter to "Pedido" (order)
      act(() => {
        fireEvent.change(selectDropdown, { target: { value: "order" } });
      });

      // Type "Mariana" (customer name) - should NOT match since we are searching by Order
      act(() => {
        fireEvent.change(searchInput, { target: { value: "Mariana" } });
      });
      const emptyContainer = screen.getByTestId("search-suggestions-container");
      expect(within(emptyContainer).getByText(/Nenhuma devolução encontrada/i)).toBeInTheDocument();

      // Type order number "SHP981" - should match RET-002
      act(() => {
        fireEvent.change(searchInput, { target: { value: "SHP981" } });
      });
      const suggestionsContainer = await screen.findByTestId("search-suggestions-container");
      expect(within(suggestionsContainer).getByText(/Mariana Costa/i)).toBeInTheDocument();
    });

    it("deve selecionar a devolução e fechar as sugestões ao clicar em um item da lista", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      act(() => {
        fireEvent.change(searchInput, { target: { value: "Carlos" } });
      });

      // Click on suggestion
      const suggestionsContainer = await screen.findByTestId("search-suggestions-container");
      const suggestionItem = within(suggestionsContainer).getByText(/Pedido: MLB3249081234/i);
      
      act(() => {
        fireEvent.click(suggestionItem);
      });

      // Input should be cleared and suggestions hidden
      expect(searchInput).toHaveValue("");
      expect(screen.queryByTestId("search-suggestions-container")).not.toBeInTheDocument();

      // Verify that the details drawer is opened
      await screen.findByLabelText("Ações da devolução");
      expect(screen.getByLabelText("Ações da devolução")).toBeInTheDocument();
    });

    it("deve exibir mensagem de 'Nenhuma devolução encontrada' se a busca não retornar resultados", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      act(() => {
        fireEvent.change(searchInput, { target: { value: "Inexistente" } });
      });

      const suggestionsContainer = await screen.findByTestId("search-suggestions-container");
      expect(within(suggestionsContainer).getByText(/Nenhuma devolução encontrada para 'Inexistente'/i)).toBeInTheDocument();
    });

    it("deve fechar as sugestões ao pressionar a tecla Escape", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      act(() => {
        fireEvent.change(searchInput, { target: { value: "Carlos" } });
      });

      await screen.findByTestId("search-suggestions-container");

      // Press Escape
      act(() => {
        fireEvent.keyDown(searchInput, { key: "Escape", code: "Escape" });
      });

      // Suggestions should disappear
      expect(screen.queryByTestId("search-suggestions-container")).not.toBeInTheDocument();
    });

    it("deve respeitar o limiar mínimo de caracteres (Threshold)", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      // Digita apenas 1 caractere
      act(() => {
        fireEvent.change(searchInput, { target: { value: "C" } });
      });

      // Container não deve aparecer
      expect(screen.queryByTestId("search-suggestions-container")).not.toBeInTheDocument();

      // Digita mais 1 caractere (total 2)
      act(() => {
        fireEvent.change(searchInput, { target: { value: "Ca" } });
      });

      // Container deve aparecer
      expect(await screen.findByTestId("search-suggestions-container")).toBeInTheDocument();
    });

    it("deve fechar as sugestões ao clicar fora do componente de busca", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      act(() => {
        fireEvent.change(searchInput, { target: { value: "Carlos" } });
      });

      expect(await screen.findByTestId("search-suggestions-container")).toBeInTheDocument();

      // Clica fora (ex: document body)
      act(() => {
        fireEvent.mouseDown(document.body);
      });

      // Deve fechar
      expect(screen.queryByTestId("search-suggestions-container")).not.toBeInTheDocument();
    });

    it("deve selecionar a devolução diretamente ao pressionar Enter quando há correspondência única", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      // Digita o código de rastreio completo da devolução B
      act(() => {
        fireEvent.change(searchInput, { target: { value: "QP102938475BR" } });
      });

      // Pressiona Enter
      act(() => {
        fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });
      });

      // Input limpo e gaveta aberta
      expect(searchInput).toHaveValue("");
      await screen.findByLabelText("Ações da devolução");
      expect(screen.getByLabelText("Ações da devolução")).toBeInTheDocument();
    });

    it("deve manter sugestões abertas e não abrir gaveta ao pressionar Enter quando há correspondência ambígua", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      // "BR" bate no rastreamento de ambas
      act(() => {
        fireEvent.change(searchInput, { target: { value: "BR" } });
      });

      const container = await screen.findByTestId("search-suggestions-container");
      expect(within(container).getAllByText(/Pedido:/i).length).toBe(2);

      // Pressiona Enter
      act(() => {
        fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });
      });

      // Gaveta não aberta (não encontra botão de ações)
      expect(screen.queryByLabelText("Ações da devolução")).not.toBeInTheDocument();
      // Container continua na tela
      expect(screen.getByTestId("search-suggestions-container")).toBeInTheDocument();
    });

    it("deve disparar alerta de erro ao pressionar Enter sem nenhuma correspondência", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      act(() => {
        fireEvent.change(searchInput, { target: { value: "inexistente" } });
      });

      // Pressiona Enter
      act(() => {
        fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });
      });

      expect(mockShowAlert).toHaveBeenCalledWith("Erro", "Nenhuma devolução localizada para o código informado", "error");
    });

    it("deve navegar por teclado na lista usando as setas ArrowDown/ArrowUp e selecionar com Enter", async () => {
      render(<ReturnsPage />);
      await screen.findByText("Carlos Silva");

      const searchInput = screen.getByPlaceholderText(/buscar devolução/i);

      // Digita "RET" para listar ambas
      act(() => {
        fireEvent.change(searchInput, { target: { value: "RET" } });
      });

      const container = await screen.findByTestId("search-suggestions-container");
      const items = within(container).getAllByText(/Pedido:/i);
      expect(items.length).toBe(2);

      // Pressiona Seta para baixo 1 vez (foca no primeiro item)
      act(() => {
        fireEvent.keyDown(searchInput, { key: "ArrowDown", code: "ArrowDown" });
      });

      // Pressiona Enter
      act(() => {
        fireEvent.keyDown(searchInput, { key: "Enter", code: "Enter" });
      });

      // Gaveta aberta
      await screen.findByLabelText("Ações da devolução");
      expect(screen.getByLabelText("Ações da devolução")).toBeInTheDocument();
      expect(searchInput).toHaveValue("");
    });
  });
});
