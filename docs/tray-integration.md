# Integracao Tray v1

Esta primeira versao usa a Tray apenas como fonte de pedidos e vendas. Devolucoes, webhooks, sincronizacao recorrente, atualizacao de status na Tray, cupons, estornos e logistica reversa ficam para fases futuras.

## Credenciais do app parceiro

A integracao foi desenhada para o modelo de parceiro/OAuth: o SellerDock tem um app Tray proprio, e cada cliente autoriza a propria loja. As credenciais do app ficam no ambiente de deploy; os tokens ficam por conta no Firestore.

Variaveis esperadas:

- `TRAY_CLIENT_ID`
- `TRAY_CLIENT_SECRET`
- `TRAY_REDIRECT_URI`
- `TRAY_AUTH_URL`
- `TRAY_TOKEN_URL`
- `TRAY_API_BASE_URL`, opcional se a Tray exigir ou nao retornar base por loja.

A criptografia usa a chave ja existente do projeto em `ANYMARKET_ENCRYPTION_KEY`.

Sem as variaveis oficiais da Tray configuradas, o botao Conectar Tray nao redireciona e a API retorna um erro amigavel de configuracao incompleta.

## Callback

Configure o app Tray para redirecionar para:

```text
{ORIGEM_DO_APP}/api/integrations/tray/callback
```

O fluxo usa `state=accountId`, seguindo o mesmo padrao da integracao Mercado Livre.

## Permissoes

- `superadmin`: pode selecionar conta, conectar, desconectar e carregar vendas dos ultimos 90 dias.
- `account_admin`: pode visualizar, conectar e desconectar a integracao da propria conta.
- Outros perfis: nao acessam a tela nem as rotas Tray.

A rota `/api/integrations/tray/sync-sales-90-days` valida `superadmin` no backend.

## Vendas e reposicao

Pedidos brutos ficam em `accounts/{accountId}/trayOrders` e itens em `accounts/{accountId}/trayOrderItems`.

As vendas tambem alimentam `accounts/{accountId}/salesDaily`, que ja e a origem das ferramentas de reposicao. Quando a conta tiver Anymarket e Tray, os valores de mesmo SKU, data e marketplace somam no mesmo documento diario.

O marketplace e normalizado a partir do canal do pedido Tray:

- Mercado Livre vira `MERCADO_LIVRE`.
- Shopee vira `SHOPEE`.
- Outros canais preservam o nome vindo da Tray em formato estavel.
- Sem canal identificavel, usa `TRAY`.

Com isso, vendas Tray classificadas como `MERCADO_LIVRE` entram na reposicao Mercado Livre, e vendas Tray classificadas como `SHOPEE` entram na reposicao Shopee.
