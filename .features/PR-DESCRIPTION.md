# 🚀 Pull Request: Lógica de Ruptura Baseada no Histórico de Inventário (ML Full)

## 📝 Descrição Geral
Esta PR implementa a evolução do cálculo de ruptura de estoque no módulo de reposição do Mercado Livre Full. Substituímos a estimativa simples de ruptura (dias sem vendas) por uma abordagem híbrida dia a dia inteligente:
1. Se houver snapshot gravado no dia para o produto na coleção `ml_full_inventory`, o status de ruptura (dias inativos) é definido diretamente pela quantidade disponível (estoque `= 0` -> ruptura/inativo; `> 0` -> ativo).
2. Se não houver snapshot para o dia, usamos a lógica de fallback de vendas:
   - Se o produto teve vendas, o dia é ativo.
   - Se o produto não teve vendas, aplicamos o ajuste de baixo giro condicionalmente para evitar falsos positivos de ruptura (para produtos com `initialGiro < 5` E `fullPeriodGiro < 1`, dias sem snapshot e sem vendas são reclassificados como ativos).

Além disso, recuperamos e enriquecemos o script de sementes `scratch-seed.ts` para permitir o teste local de todos os perfis no Firebase Emulator.

## 🛠️ Modificações Realizadas
- [002-ruptura-estoque-historico.md](file:///home/dom/Projects/prototipandoAI/marketplace-tools/.features/002-ruptura-estoque-historico.md): Checklist de tarefas marcado como concluído e status alterado para Concluído.
- [scratch-seed.ts](file:///home/dom/Projects/prototipandoAI/marketplace-tools/scratch-seed.ts): Semente local recuperada e enriquecida com massas de teste cobrindo produtos de alto giro, baixo giro e fallbacks.
- [route.ts](file:///home/dom/Projects/prototipandoAI/marketplace-tools/src/app/api/integrations/mercadolivre/inventory/route.ts): API estendida para suportar parâmetro de histórico `days` e retornar `inventoryHistory` no JSON.
- [types.ts](file:///home/dom/Projects/prototipandoAI/marketplace-tools/src/app/full-replenishment/meli/types.ts): Estrutura `ProdutoProcessado` atualizada para suportar histórico de inventário.
- [core-logic.ts](file:///home/dom/Projects/prototipandoAI/marketplace-tools/src/app/full-replenishment/meli/core-logic.ts): Cálculo híbrido diário e ajuste de baixo giro implementados.
- [useReposicaoState.tsx](file:///home/dom/Projects/prototipandoAI/marketplace-tools/src/app/full-replenishment/meli/useReposicaoState.tsx): Hook atualizado para consultar histórico e passar os dados agregados para processamento.
- [core-logic.test.ts](file:///home/dom/Projects/prototipandoAI/marketplace-tools/src/app/full-replenishment/meli/__tests__/core-logic.test.ts): Criado novo arquivo contendo 3 suítes de testes unitários validando todos os cenários da especificação BDD.

## 🧪 Validação e Testes
- [x] Executado `npm run test` com sucesso (100% de cenários BDD passando).
- [x] Executado `npm run build` sem erros de compilação TypeScript.
- [x] Executado `npm run lint` sem violações do ESLint nos arquivos modificados/adicionados.

## 🧑‍💻 Como Testar Manualmente (Passos para o Revisor)
1. Certifique-se de iniciar o Firestore Emulator localmente.
2. Execute o script de seed para criar a massa de dados de teste:
   ```bash
   npx tsx scratch-seed.ts
   ```
3. Acesse a rota `/full-replenishment/meli` na aplicação.
4. Verifique na tabela de reposição se os produtos `SKU-TEST-01`, `SKU-TEST-02` e `SKU-TEST-03` aparecem e com os dias inativos computados corretamente conforme a massa do Firestore.
