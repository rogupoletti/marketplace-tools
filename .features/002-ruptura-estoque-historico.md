# FEATURE-002: Lógica de Ruptura Baseada no Histórico de Inventário (ML Full)

| Metadado | Detalhe |
| :--- | :--- |
| **Branch Base** | `master` |
| **Feature Branch** | `feature/ruptura-estoque-historico` |
| **Status** | 🟢 Concluído |

---

## 📋 Contexto e Objetivo
Anteriormente, o sistema estimava os dias de ruptura de forma indireta usando os dias sem vendas (`diasComVendas.size`). Agora, com a coleção `ml_full_inventory` registrando históricos periódicos (snapshots) de estoque, utilizaremos uma lógica híbrida refinada dia a dia:
1. **Com Snapshot**: Se existe snapshot gravado para o produto no dia $d$, definimos a ruptura pela quantidade: se estoque `= 0`, é considerado dia de ruptura (inativo). Se estoque `> 0`, é considerado dia ativo.
2. **Sem Snapshot**: Se não há snapshot para o produto no dia $d$, aplicamos a regra de vendas condicional ao giro:
   - Se o produto teve vendas (`vendaQtd > 0`), o dia é considerado ativo.
   - Se o produto não teve vendas:
     - Se for classificado como **baixo giro** (ajuste ativo), o dia é considerado **ativo** (não houve ruptura, apenas não vendeu por ser baixo giro).
     - Se **não** for baixo giro, o dia é considerado de **ruptura** (inativo).

Isso garante que:
- Rupturas reais confirmadas por snapshots com estoque zero (`available_quantity <= 0`) sejam sempre computadas, independente do giro do produto.
- Dias sem vendas e sem snapshots não gerem falsos positivos de ruptura para produtos de baixo giro.

---

## 🧪 Massa de Dados de Teste (Mock Data)

Para validação das lógicas no backend e frontend, utilizaremos a seguinte massa de dados fictícia coerente com o schema gravado no Firestore e com a estrutura do Excel.

### 1. Parâmetros e Mapeamento de Teste
- **Período Analisado**: 10 dias (de `2026-06-14` a `2026-06-23`)
- **Data de Referência (Hoje)**: `2026-06-23`
- **Mapeamento de SKUs e MLBs**:
  - `SKU-TEST-01` -> MLB ID: `MLB1001` (Produto de baixo giro)
  - `SKU-TEST-02` -> MLB ID: `MLB1002` (Produto de alto giro)

### 2. Documentos da Coleção `ml_full_inventory` (Firestore)
Os registros correspondem ao schema `MLFullInventorySnapshot` persistido pelo cron de sincronização:

```json
[
  /* SKU-TEST-01 (MLB1001) */
  { "item_id": "MLB1001", "title": "Produto Teste 01", "available_quantity": 5, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781481600000 }, // 2026-06-14 (Ativo)
  { "item_id": "MLB1001", "title": "Produto Teste 01", "available_quantity": 4, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781568000000 }, // 2026-06-15 (Ativo)
  { "item_id": "MLB1001", "title": "Produto Teste 01", "available_quantity": 0, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781654400000 }, // 2026-06-16 (Ruptura)
  { "item_id": "MLB1001", "title": "Produto Teste 01", "available_quantity": 0, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781740800000 }, // 2026-06-17 (Ruptura)
  { "item_id": "MLB1001", "title": "Produto Teste 01", "available_quantity": 2, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781827200000 }, // 2026-06-18 (Ativo)

  /* SKU-TEST-02 (MLB1002) */
  { "item_id": "MLB1002", "title": "Produto Teste 02", "available_quantity": 10, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781481600000 }, // 2026-06-14 (Ativo)
  { "item_id": "MLB1002", "title": "Produto Teste 02", "available_quantity": 5, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781568000000 }, // 2026-06-15 (Ativo)
  { "item_id": "MLB1002", "title": "Produto Teste 02", "available_quantity": 0, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781654400000 }, // 2026-06-16 (Ruptura)
  { "item_id": "MLB1002", "title": "Produto Teste 02", "available_quantity": 0, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781740800000 }, // 2026-06-17 (Ruptura)
  { "item_id": "MLB1002", "title": "Produto Teste 02", "available_quantity": 15, "status": "active", "logistic_type": "fulfillment", "permalink": "...", "snapshot_at": 1781827200000 }  // 2026-06-18 (Ativo)
]
```
*(Nota: Do dia 2026-06-19 ao dia 2026-06-23 não há snapshots salvos para nenhum dos itens).*

### 3. Planilha de Vendas (Excel importado / `vendasRaw` por SKU)

```json
{
  "SKU-TEST-01": [
    { "sku": "SKU-TEST-01", "data": "2026-06-19", "vendaQtd": 2, "vendaValorLiquido": 80.00, "vendaValorBruto": 100.00 },
    { "sku": "SKU-TEST-01", "data": "2026-06-21", "vendaQtd": 3, "vendaValorLiquido": 120.00, "vendaValorBruto": 150.00 },
    { "sku": "SKU-TEST-01", "data": "2026-06-23", "vendaQtd": 3, "vendaValorLiquido": 120.00, "vendaValorBruto": 150.00 }
  ],
  "SKU-TEST-02": [
    { "sku": "SKU-TEST-02", "data": "2026-06-19", "vendaQtd": 10, "vendaValorLiquido": 400.00, "vendaValorBruto": 500.00 },
    { "sku": "SKU-TEST-02", "data": "2026-06-21", "vendaQtd": 20, "vendaValorLiquido": 800.00, "vendaValorBruto": 1000.00 },
    { "sku": "SKU-TEST-02", "data": "2026-06-23", "vendaQtd": 30, "vendaValorLiquido": 1200.00, "vendaValorBruto": 1500.00 }
  ]
}
```
*(Nota: Nos dias não listados acima, as vendas foram zero).*

### 4. Resultados Calculados Esperados (Fluxo de Dois Passos)

#### SKU-TEST-01 (`MLB1001`) - Baixo Giro (Ajuste Ativado)
1. **Passo 1 (Cálculo com Regra Padrão)**:
   - Dia 1 (`2026-06-14`): Ativo (snapshot existe, qtde = 5 > 0)
   - Dia 2 (`2026-06-15`): Ativo (snapshot existe, qtde = 4 > 0)
   - Dia 3 (`2026-06-16`): Inativo (snapshot existe, qtde = 0)
   - Dia 4 (`2026-06-17`): Inativo (snapshot existe, qtde = 0)
   - Dia 5 (`2026-06-18`): Ativo (snapshot existe, qtde = 2 > 0)
   - Dia 6 (`2026-06-19`): Ativo (sem snapshot, vendaQtd = 2)
   - Dia 7 (`2026-06-20`): Inativo (sem snapshot, vendaQtd = 0)
   - Dia 8 (`2026-06-21`): Ativo (sem snapshot, vendaQtd = 3)
   - Dia 9 (`2026-06-22`): Inativo (sem snapshot, vendaQtd = 0)
   - Dia 10 (`2026-06-23`): Ativo (sem snapshot, vendaQtd = 3)
   - *Subtotal*: `diasInativos = 4` (Dias 3, 4, 7, 9) e `diasAtivos = 6`.
   - *Métricas*: `initialGiro = 8 / 6 = 1.33` e `fullPeriodGiro = 8 / 10 = 0.8`.
2. **Passo 2 (Classificação de Baixo Giro e Recálculo)**:
   - Como `initialGiro < 5` e `fullPeriodGiro < 1`, o produto é classificado como baixo giro.
   - Recalculamos dia a dia desconsiderando a ruptura dos dias sem snapshots:
     - Dias 7 e 9 (sem snapshot e sem vendas) passam de inativos para **ativos**.
     - Dias 3 e 4 (com snapshot = 0) continuam **inativos** (ruptura confirmada).
   - *Resultado Final*: `diasInativos = 2` (Dias 3 e 4), `diasAtivos = 8`, `giroDiarioQtd = 8 / 8 = 1.0`.

#### SKU-TEST-02 (`MLB1002`) - Alto Giro (Ajuste Não Ativado)
1. **Passo 1 (Cálculo com Regra Padrão)**:
   - Dia 1 (`2026-06-14`): Ativo (snapshot existe, qtde = 10 > 0)
   - Dia 2 (`2026-06-15`): Ativo (snapshot existe, qtde = 5 > 0)
   - Dia 3 (`2026-06-16`): Inativo (snapshot existe, qtde = 0)
   - Dia 4 (`2026-06-17`): Inativo (snapshot existe, qtde = 0)
   - Dia 5 (`2026-06-18`): Ativo (snapshot existe, qtde = 15 > 0)
   - Dia 6 (`2026-06-19`): Ativo (sem snapshot, vendaQtd = 10)
   - Dia 7 (`2026-06-20`): Inativo (sem snapshot, vendaQtd = 0)
   - Dia 8 (`2026-06-21`): Ativo (sem snapshot, vendaQtd = 20)
   - Dia 9 (`2026-06-22`): Inativo (sem snapshot, vendaQtd = 0)
   - Dia 10 (`2026-06-23`): Ativo (sem snapshot, vendaQtd = 30)
   - *Subtotal*: `diasInativos = 4` (Dias 3, 4, 7, 9) e `diasAtivos = 6`.
   - *Métricas*: `initialGiro = 60 / 6 = 10.0` e `fullPeriodGiro = 60 / 10 = 6.0`.
2. **Passo 2 (Classificação)**:
   - Como `initialGiro >= 5`, ele **não** é baixo giro. Mantemos o cálculo do Passo 1.
   - *Resultado Final*: `diasInativos = 4` (Dias 3, 4, 7, 9), `diasAtivos = 6`, `giroDiarioQtd = 60 / 6 = 10.0`.

---

## 🛠️ Tasks de Desenvolvimento

> [!IMPORTANT]
> **Instruções para o Agente**: À medida que você concluir as tarefas técnicas abaixo e os testes correspondentes passarem, atualize este arquivo mudando os checkboxes de `- [ ]` para `- [x]` e faça o commit desta alteração juntamente com o seu código.

### Task 1: API de Histórico de Inventário (Backend)
- [x] **Subtask Técnica 1**: Modificar a API `/api/integrations/mercadolivre/inventory` para aceitar opcionalmente o parâmetro de histórico `days` (padrão: 90).
- [x] **Subtask Técnica 2**: Consultar a coleção `ml_full_inventory` buscando os snapshots salvos no período selecionado (`days`).
- [x] **Subtask Técnica 3**: Agrupar e retornar os dados de forma que a API entregue um mapeamento dos snapshots de estoque diários reais salvos no banco. Exemplo de retorno:
  ```json
  {
    "inventory": { "MLB1001": 2, "MLB1002": 15 },
    "inventoryHistory": {
      "MLB1001": {
        "2026-06-14": 5,
        "2026-06-15": 4,
        "2026-06-16": 0,
        "2026-06-17": 0,
        "2026-06-18": 2
      },
      "MLB1002": {
        "2026-06-14": 10,
        "2026-06-15": 5,
        "2026-06-16": 0,
        "2026-06-17": 0,
        "2026-06-18": 15
      }
    }
  }
  ```
- [x] **Subtask Técnica 4 (Testes)**: Implementar teste para garantir que a API responde no formato correto a partir da coleção de snapshots no Firestore.

#### 🧪 Cenários de Aceite (BDD)
*   **Cenário 1: API retorna histórico de estoque por dia para produtos com snapshots**
    *   **Dado** que a coleção `ml_full_inventory` possui registros de estoque diários para o item `MLB1001`
    *   **Quando** a API for consultada com `days=10`
    *   **Então** a resposta deve conter a chave `inventoryHistory` trazendo os dias de registros reais do item mapeados para suas quantidades.

*   **Cenário 2: API responde com sucesso e com histórico vazio para produtos sem snapshots**
    *   **Dado** que o item `MLB999` não possui nenhum snapshot gravado na coleção `ml_full_inventory` nos últimos 10 dias
    *   **Quando** a API for consultada com `days=10`
    *   **Então** a chave `inventoryHistory` na resposta não deve conter a chave `MLB999` (ou deve retornar um objeto vazio `{}`).

---

### Task 2: Implementação da Nova Lógica e Fallback (Frontend & Core Logic)
- [x] **Subtask Técnica 1**: Atualizar `types.ts` para refletir `inventoryHistory?: Record<string, Record<string, number>>`.
- [x] **Subtask Técnica 2**: Atualizar o hook `useReposicaoState` para passar o histórico de estoque de cada MLB para a função `processProduct`.
- [x] **Subtask Técnica 3**: Modificar `processProduct` em `core-logic.ts` para implementar o cálculo híbrido em dois passos (Passo 1 para classificação de baixo giro e Passo 2 para ajuste condicional das rupturas em dias sem snapshots).
- [x] **Subtask Técnica 4**: Codificar a massa de dados fictícia do mock acima em um arquivo de teste e validar se o motor calcula exatamente os valores esperados.

#### 🧪 Cenários de Aceite (BDD)
*   **Cenário 1: Processamento calcula corretamente os dias inativos híbridos (snapshot + vendas) e aplica o giro**
    *   **Dado** a massa de dados fictícia para `SKU-TEST-02`
    *   **Quando** a função `processProduct` rodar
    *   **Então** deve retornar `diasInativos = 4`, `diasAtivos = 6` e `giroDiarioQtd = 10.0`

*   **Cenário 2: Processamento ativa o ajuste de baixo giro preservando rupturas confirmadas**
    *   **Dado** a massa de dados fictícia para `SKU-TEST-01`
    *   **Quando** a função `processProduct` rodar
    *   **Então** deve retornar `diasInativos = 2` (apenas as rupturas confirmadas do snapshot nos Dias 3 e 4) e `giroDiarioQtd = 1.0`

*   **Cenário 3: Processamento de produto sem histórico usa fallback de vendas**
    *   **Dado** um produto com SKU `SKU-TEST-03` que não possui nenhum snapshot de inventário registrado no histórico
    *   **Quando** a função `processProduct` rodar com 10 vendas em 5 dias específicos do período de 10 dias
    *   **Então** o cálculo deve estimar os dias inativos usando a regra das vendas dia a dia (5 dias ativos e 5 dias inativos), resultando em `diasInativos = 5` e `giroDiarioQtd = 2.0`.

