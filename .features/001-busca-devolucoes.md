# FEATURE-001: Busca por Código com Autocomplete nas Devoluções

| Metadado | Detalhe |
| :--- | :--- |
| **Branch Base** | `main` |
| **Feature Branch** | `feature/busca-devolucoes-autocomplete` |
| **Status** | 🟡 Em Progresso |

---

## 📋 Contexto e Objetivo
Atualmente, a página de devoluções possui filtros individuais como "Pedido" e "Nota Fiscal" que apenas filtram visualmente os cards do quadro Kanban.
O objetivo desta feature é criar uma **Busca Rápida** permanente no topo da página. Ao digitar um código (ou ler com leitor de código de barras), o sistema deve exibir sugestões (Autocomplete) e, ao selecionar uma delas, abrir **diretamente a gaveta/painel lateral de detalhes da devolução**, sem alterar o filtro dos cards na tela.

---

## 💾 Massa de Dados Fictícia para Testes e Validação
Para todos os cenários abaixo, assuma que a lista local possui os dois registros seguintes:

### Registro A:
- `id`: `"ret-123"`
- `marketplaceReturnId`: `"meli-ret-999"`
- `orderNumber`: `"order-abc-111"`
- `reverseTrackingCode`: `"QM123456789BR"`
- `customerName`: `"Maria de Souza"`
- `channel`: `"meli"`
- `invoiceNumber`: `"10050"`
- `returnDate`: `"2026-06-14"`

### Registro B:
- `id`: `"ret-456"`
- `marketplaceReturnId`: `"shp-ret-888"`
- `orderNumber`: `"order-xyz-222"`
- `reverseTrackingCode`: `"BR987654321SP"`
- `customerName`: `"João da Silva"`
- `channel`: `"shopee"`
- `invoiceNumber`: `"20060"`
- `returnDate`: `"2026-06-15"`

---

## 🛠️ Tasks de Desenvolvimento

> [!IMPORTANT]
> **Instruções para o Agente**: À medida que você concluir as tarefas técnicas abaixo e os testes correspondentes passarem, atualize este arquivo mudando os checkboxes de `- [ ]` para `- [x]` e faça o commit desta alteração juntamente com o seu código.

### Task 1: Componente de Busca UI (Input Group)
- [x] **Subtask 1.1**: Remover `orderNumber` e `invoiceNumber` do estado `filters` e adicionar os estados `searchField` (default `"all"`) e `searchQuery` (default `""`) na página `src/app/returns/page.tsx`.
- [x] **Subtask 1.2**: Inserir o componente de busca permanente na seção de cabeçalho do card de filtros (entre as informações de contagem de devoluções à esquerda e o botão "Mostrar/Ocultar filtros" à direita) do arquivo `src/app/returns/page.tsx` (linhas ~923-935). Isso garante visibilidade permanente independente do painel colapsável de filtros estar aberto ou fechado.
- [x] **Subtask 1.3**: Estilizar o componente como um "Input Group" do Tailwind CSS: à esquerda um dropdown select (`searchField`) e à direita o input de texto (`searchQuery`).
- [x] **Subtask 1.4**: Adicionar um botão de limpar (`X`) posicionado absolutamente no canto direito do input, visível apenas quando `searchQuery` tiver texto.
- [x] **Subtask 1.5**: Atualizar a função `clearFilters` para remover a redefinição de `orderNumber` e `invoiceNumber`, e adicionar a redefinição de `searchField` (para `"all"`) e `searchQuery` (para `""`).
- [x] **Subtask 1.6**: Remover os inputs de "Pedido" e "Nota fiscal" do painel colapsável de filtros (`isFiltersOpen`) do arquivo `src/app/returns/page.tsx` para evitar redundância visual.

#### 🧪 Cenários de Aceite (BDD)
*   **Cenário 1.1: Exibição padrão do componente**
    *   **Dado** que o usuário acessou a página de Gestão de Devoluções.
    *   **Então** o campo de busca rápida deve estar visível de forma permanente abaixo do cabeçalho de filtros, exibindo o select com a opção "Todos" e o input de texto vazio.
*   **Cenário 1.2: Ação de limpar busca**
    *   **Dado** que o usuário digitou `"QM1234"` no campo de busca rápida.
    *   **Quando** o usuário clica no botão "X" de limpeza.
    *   **Então** o input de busca rápida deve ficar vazio e o botão "X" deve desaparecer.

---

### Task 2: Painel de Autocomplete (Sugestões)
- [x] **Subtask 2.1**: Criar o contêiner flutuante (overlay absoluto com `z-50`) abaixo do input de busca que exibe sugestões correspondentes ao termo digitado (ativado a partir de 2 caracteres).
- [x] **Subtask 2.2**: Limitar a altura visível do contêiner para o equivalente a 5 itens (ex: `max-h-64` ou `max-h-[280px]`) e habilitar barra de rolagem vertical (`overflow-y-auto`).
- [x] **Subtask 2.3**: Para otimização de performance do DOM, limitar o array de sugestões renderizado para no máximo as 20 primeiras correspondências (ex: `.slice(0, 20)`).
- [x] **Subtask 2.4**: Estilizar cada sugestão do autocomplete exibindo:
  - **Esquerda**: Badge visual do canal (Meli com cor amarela, Shopee com cor laranja).
  - **Centro**: `Devolução ID` em destaque (ex.: `meli-ret-999` em negrito), seguido de `Pedido` e `Cliente` em subtexto menor.
  - **Direita**: Data da devolução formatada (ex.: `14/06/2026`).
  - **Contexto**: Se o campo pesquisado for diferente de `marketplaceReturnId`, exibir o valor e o nome do campo correspondente em uma linha adicional (ex.: `Rastreio: QM123456789BR`).

#### 🧪 Cenários de Aceite (BDD)
*   **Cenário 2.1: Exibição do Autocomplete**
    *   **Dado** que os Registros A e B estão carregados na memória do componente.
    *   **E** o tipo de busca selecionado é "Todos".
    *   **Quando** o usuário digita `"Maria"` no campo de busca.
    *   **Então** a lista de autocomplete deve abrir contendo exatamente **uma** sugestão correspondente à Maria de Souza (Registro A).
*   **Cenário 2.2: Limiar mínimo de caracteres (Threshold)**
    *   **Dado** que o input de busca rápida está vazio.
    *   **Quando** o usuário digita apenas um caractere `"M"`.
    *   **Então** a lista de autocomplete **não deve** ser exibida.
*   **Cenário 2.3: Ocultação da lista por clique fora**
    *   **Dado** que o autocomplete está aberto na tela mostrando o Registro A.
    *   **Quando** o usuário clica em qualquer área fora da caixa de busca.
    *   **Então** o contêiner de autocomplete deve ser destruído/ocultado do DOM.
*   **Cenário 2.4: Fechar lista com a tecla Escape**
    *   **Dado** que o autocomplete está aberto na tela.
    *   **Quando** o usuário pressiona a tecla **Escape** no teclado.
    *   **Então** a lista de sugestões deve fechar imediatamente.
*   **Cenário 2.5: Nenhum resultado encontrado**
    *   **Dado** que os Registros A e B estão carregados na memória do componente.
    *   **Quando** o usuário digita `"inexistente"` no campo de busca.
    *   **Então** o autocomplete deve abrir exibindo uma mensagem informativa: `"Nenhuma devolução encontrada para 'inexistente'"`.

---

### Task 3: Lógica de Busca e Seleção Direta
- [x] **Subtask 3.1**: Implementar a lógica de match para os seguintes campos de `MarketplaceReturn`:
  - Se `searchField` for `"order"`: Busca por `orderNumber`, `externalOrderId`, `marketplaceOrderId`.
  - Se `searchField` for `"tracking"`: Busca por `trackingCode`, `reverseTrackingCode`, `reverseTrackingNumber`.
  - Se `searchField` for `"invoice"`: Busca por `invoiceNumber`.
  - Se `searchField` for `"returnId"`: Busca por `externalReturnId`, `marketplaceReturnId`.
  - Se `searchField` for `"all"`: Busca por todos os anteriores + `id`, `shipmentId`, `packId`.
- [x] **Subtask 3.2**: Ao clicar em uma sugestão do autocomplete, abrir a gaveta lateral de detalhes da devolução (`setSelectedReturn`) e limpar o input de busca.
- [x] **Subtask 3.3**: Adicionar comportamento para o pressionamento de **Enter**: se a busca retornar exatamente **um** item exato, selecioná-lo automaticamente e abrir a gaveta de detalhes diretamente.
- [x] **Subtask 3.4**: Remover a lógica de filtragem de `orderNumber` e `invoiceNumber` da constante `filteredReturns` no arquivo `src/app/returns/page.tsx` (já que o filtro de cards não deve mais escutar esses campos de busca).

#### 🧪 Cenários de Aceite (BDD)
*   **Cenário 3.1: Busca em múltiplos campos (Padrão "Todos")**
    *   **Dado** que a opção "Todos" está selecionada no dropdown.
    *   **Quando** o usuário digita `"QM1234"` no campo de busca.
    *   **Então** o autocomplete deve sugerir o Registro A (pois o código de rastreio `QM123456789BR` possui match).
*   **Cenário 3.2: Restrição de tipo de busca (Falso Positivo)**
    *   **Dado** que a opção "Nº do Pedido" está selecionada no dropdown.
    *   **Quando** o usuário digita `"QM1234"` no campo de busca.
    *   **Então** o autocomplete **não deve** exibir nenhuma sugestão.
*   **Cenário 3.3: Seleção direta por Enter (Correspondência Única)**
    *   **Dado** que o usuário digitou o código de rastreio completo `"BR987654321SP"`.
    *   **Quando** o usuário pressiona a tecla **Enter**.
    *   **Então** a gaveta de detalhes lateral deve ser aberta exibindo as informações da Devolução B (`shp-ret-888`) e o input de busca deve ser limpo imediatamente.
*   **Cenário 3.4: Ambiguidade por Enter (Múltiplas Correspondências)**
    *   **Dado** que os Registros A e B possuem termos de busca que contêm `"order-"` nos números de pedido (`order-abc-111` e `order-xyz-222`).
    *   **E** a opção "Todos" está selecionada no dropdown.
    *   **Quando** o usuário digita `"order-"` no campo de busca rápida e pressiona a tecla **Enter**.
    *   **Então** o autocomplete deve permanecer aberto exibindo ambas as sugestões (Registro A e Registro B), permitindo que o usuário selecione uma delas manualmente, e nenhuma gaveta lateral de detalhes deve se abrir de forma automática.
*   **Cenário 3.5: Pressionar Enter sem correspondência**
    *   **Dado** que o usuário digitou o termo `"inexistente"` no input de busca rápida.
    *   **Quando** o usuário pressiona a tecla **Enter**.
    *   **Então** nenhuma gaveta lateral de detalhes deve se abrir, e uma notificação de erro/toast rápida deve ser exibida informando: `"Nenhuma devolução localizada para o código informado"`.
*   **Cenário 3.6: Tolerância de entrada (Trim & Case-insensitivity)**
    *   **Dado** que a opção "Todos" está selecionada no dropdown.
    *   **Quando** o usuário digita `"  qm123456789br   "` (com espaços extras e letras minúsculas).
    *   **Então** o autocomplete deve sugerir o Registro A normalmente.
*   **Cenário 3.7: Navegação por teclado na lista**
    *   **Dado** que o autocomplete está aberto com as sugestões do Registro A e Registro B.
    *   **Quando** o usuário pressiona a tecla **Seta para Baixo** uma vez e depois a tecla **Enter**.
    *   **Então** o primeiro item (Registro A) deve ser selecionado, abrindo a gaveta de detalhes lateral, e a lista de sugestões deve fechar.
*   **Cenário 3.8: Busca independente de filtros laterais (Quadro Kanban)**
    *   **Dado** que o usuário ativou o filtro lateral de Canal para mostrar apenas `"shopee"` (ocultando visualmente a devolução do Registro A do quadro Kanban).
    *   **Quando** o usuário digita `"Maria"` na busca rápida do topo.
    *   **Então** o autocomplete deve sugerir o Registro A normalmente e permitir sua seleção para abrir a gaveta de detalhes (mesmo o card estando oculto nas colunas).

---

## 💡 Direcionamentos Técnicos (Staff Review)

Para garantir a qualidade, performance e manutenibilidade da entrega, siga estes guias arquiteturais:

### 1. Isolamento de Estado (Prevenção de Lag de Digitação)
- **Não** armazene `searchQuery` e `searchField` dentro do objeto de estado global `filters` (que renderiza e filtra os cards do quadro Kanban).
- **Faça**: Crie estados separados localmente na página `returns/page.tsx` para controlar a busca e as sugestões (ex: `const [searchQuery, setSearchQuery] = useState("")`). Isso garante que a digitação não dispare re-renderizações caras sobre o grid de colunas Kanban.

### 2. Defesa contra Runtime Errors (TypeScript & Nullish coalescing)
- **Não** chame funções de string diretamente em campos opcionais dos documentos de devolução do Firestore (ex: `item.reverseTrackingCode.toLowerCase()`).
- **Faça**: Garanta tratamento defensivo para campos que podem vir vazios ou indefinidos no banco usando coalescência nula (ex: `(item.reverseTrackingCode || "").toLowerCase().includes(...)`).

### 3. UX de Clique vs. Blur no Autocomplete
- **Não** tente fechar o autocomplete usando o evento `onBlur` puro no elemento `<input>`, pois isso cancelará o evento de clique na linha da sugestão antes que ele seja processado.
- **Faça**: Implemente uma referência React (`useRef`) no contêiner da busca e um escutador de cliques fora (`mousedown`/`click`) para fechar o autocomplete de forma limpa e segura.

### 4. Acessibilidade de Teclado
- **Não** limite a navegação no menu flutuante ao clique do mouse.
- **Faça**: Adicione tratamento para teclas direcionais (`ArrowDown`/`ArrowUp`) permitindo navegar graficamente pela lista de sugestões, `Enter` para selecionar o item selecionado pelo teclado, e `Escape` para fechar a caixa de sugestões instantaneamente.

### 5. Reutilização de Funções Existentes (DRY - Don't Repeat Yourself)
- **Não** recrie a lógica de abertura do painel lateral de detalhes, chamadas à API `/api/returns/[id]` ou controle do estado de carregamento do menu lateral.
- **Faça**: Chame diretamente a função assíncrona existente **`fetchReturnDetail(matchedReturn)`** declarada no escopo do componente. Ela já gerencia a abertura da gaveta lateral (`selectedReturn`), gerencia o estado `isDetailLoading` e popula o histórico e fotos buscando diretamente da API.

### 6. Design System & Classes Sugeridas (Tailwind v4)
Para manter a consistência estética do projeto, utilize as seguintes classes:

- **Contêiner do Input Group (Select + Input)**:
  `className="relative flex items-center border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-[#2d3277]/20 focus-within:border-[#2d3277]/30 transition-all w-full max-w-xl mb-4"`
- **Dropdown Select (Tipo de Busca)**:
  `className="bg-transparent border-r border-gray-200 rounded-l-lg py-1.5 pl-3 pr-8 text-xs text-gray-500 font-semibold focus:outline-none focus:ring-0 cursor-pointer h-full outline-none"`
- **Input de Texto (Busca)**:
  `className="bg-transparent flex-1 py-1.5 pl-3 pr-8 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 outline-none w-full"`
- **Contêiner do Autocomplete (Lista Suspensa)**:
  `className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-y-auto max-h-64 divide-y divide-gray-100"`
- **Itens do Autocomplete**:
  `className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors focus:bg-gray-50 outline-none"`
- **Badges de Canal**:
  - Mercado Livre: `className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200"`
  - Shopee: `className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200"`
  - Padrão/Outros: `className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200"`

### 7. Estratégia de Mocking nos Testes (Vitest)
Como o componente `ReturnsPage` é integrado a contextos globais de autenticação, estado global de UI e conexões ao Firebase, você **precisará** mockar estas dependências em `src/app/returns/__tests__/search.test.tsx` para evitar quebras nos testes. Utilize o padrão de mocks do Vitest:
```typescript
import { vi } from "vitest";

// Mock do Next.js Navigation
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

// Mock do contexto de autenticação do Firebase
vi.mock("@/lib/auth-context", () => ({
    useAuth: () => ({
        user: { getIdToken: vi.fn().mockResolvedValue("mock-token") },
        userData: { role: "admin", isAdmin: false },
    }),
}));

// Mock do contexto de interface de UI
vi.mock("@/lib/ui-context", () => ({
    useUI: () => ({
        showAlert: vi.fn(),
    }),
}));

// Mock das operações do Firestore
vi.mock("firebase/firestore", () => ({
    collection: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    query: vi.fn(),
    orderBy: vi.fn(),
}));
```

---

### Task 4: Testes Automatizados (Vitest)
- [x] **Subtask 4.1**: Criar o arquivo de teste `src/app/returns/__tests__/search.test.tsx`.
- [x] **Subtask 4.2**: Escrever testes cobrindo a renderização do novo componente, o funcionamento do autocomplete baseado no estado de `returns` mockado, a seleção de sugestões e a abertura do painel de detalhes.

#### 🧪 Cenários de Aceite (BDD)
*   **Cenário 4.1: Execução e sucesso dos testes**
    *   **Dado** que os testes da funcionalidade de busca foram implementados com a massa de dados fictícia especificada.
    *   **Quando** o comando `npm run test` é executado no terminal.
    *   **Então** a suíte de testes deve passar com 100% de sucesso.
