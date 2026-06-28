import * as admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = "marketplace-suite-2026";

admin.initializeApp({
  projectId: "marketplace-suite-2026",
});

const db = admin.firestore();
const auth = admin.auth();

function formatDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  console.log("--- Inserindo Dados Mock Completos no Firebase Emulator ---");

  const mockEmail = "teste@test.com";
  const mockAccountId = "mock-account-id";
  let mockUid = "";

  // 1. Obter usuário no Auth do Emulador (não criar se não existir)
  try {
    const userRecord = await auth.getUserByEmail(mockEmail);
    mockUid = userRecord.uid;
    console.log(`Usuário ${mockEmail} encontrado no Auth com UID: ${mockUid}`);
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      console.error(`Erro: O usuário ${mockEmail} não foi criado no emulador ainda. Crie-o manualmente antes de rodar o script.`);
    } else {
      console.error("Erro ao obter usuário do Auth:", error);
    }
    process.exit(1);
  }

  // 2. Criar usuário no Firestore
  await db.collection("users").doc(mockUid).set({
    email: mockEmail,
    role: "superadmin",
    accountId: mockAccountId,
    requiresPasswordChange: false,
    createdAt: new Date().toISOString(),
  });
  console.log(`Documento de usuário criado no Firestore (/users/${mockUid}).`);

  // 2.5. Criar conta no Firestore
  await db.collection("accounts").doc(mockAccountId).set({
    name: "Conta de Teste",
    createdAt: new Date().toISOString(),
  });
  console.log(`Documento de conta criado no Firestore (/accounts/${mockAccountId}).`);

  // 2.6. Criar páginas de Relatório (Dashboard Power BI)
  const pages = [
    {
      title: "Painel Comercial - Geral",
      embedUrl: "https://wikipedia.org", // Carrega o site para fins de teste no iframe
      accountId: mockAccountId,
      createdAt: new Date().toISOString(),
    },
    {
      title: "Análise de Estoque e Margens",
      embedUrl: "https://wikipedia.org",
      accountId: mockAccountId,
      createdAt: new Date().toISOString(),
    }
  ];

  for (let idx = 0; idx < pages.length; idx++) {
    await db.collection("pages").doc(`page-00${idx + 1}`).set(pages[idx]);
  }
  console.log(`Páginas de relatórios criadas na coleção raiz /pages.`);

  // 2.7. Criar integrações na conta
  await db.collection("accounts").doc(mockAccountId).collection("integrations").doc("anymarket").set({
    ativo: true,
    token: "mock-token-anymarket",
    status: "concluido",
    updatedAt: new Date().toISOString(),
  });
  await db.collection("accounts").doc(mockAccountId).collection("integrations").doc("mercadolivre").set({
    ativo: true,
    accessToken: "mock-access-token-ml",
    nickname: "LOJA_TESTE_ML",
    updatedAt: new Date().toISOString(),
  });
  console.log("Integrações AnyMarket e Mercado Livre ativadas.");

  // 3. Criar produtos mockados
  const products = [
    {
      sku: "PROD-001",
      ean: "7891234567890",
      descricao: "Camiseta Térmica Esportiva Dry Fit",
      marca: "Nike",
      fornecedor: "Nike BR",
      estoqueFull: 45,
      estoqueEmpresa: 80,
      precoAtual: 89.90,
      custoAtual: 35.00,
      tamanhoCaixa: 1,
      emTransf: 10,
      inativo: false,
      mlb: "MLB3249081234",
      shopeeItemId: "SHP11223344",
      shopeeModelId: "MOD1122",
    },
    {
      sku: "PROD-002",
      ean: "7891234567891",
      descricao: "Tênis Running Performance Flex",
      marca: "Adidas",
      fornecedor: "Adidas BR",
      estoqueFull: 12,
      estoqueEmpresa: 34,
      precoAtual: 299.90,
      custoAtual: 130.00,
      tamanhoCaixa: 2,
      emTransf: 0,
      inativo: false,
      mlb: "MLB123984712",
      shopeeItemId: "SHP55667788",
      shopeeModelId: "MOD5566",
    },
    {
      sku: "PROD-003",
      ean: "7891234567892",
      descricao: "Boné Ajustável Sport Aba Curva",
      marca: "Puma",
      fornecedor: "Puma BR",
      estoqueFull: 150,
      estoqueEmpresa: 220,
      precoAtual: 59.90,
      custoAtual: 18.50,
      tamanhoCaixa: 1,
      emTransf: 50,
      inativo: false,
      mlb: "MLB992837482",
      shopeeItemId: "SHP99001122",
      shopeeModelId: "MOD9900",
    }
  ];

  for (const product of products) {
    await db.collection("accounts").doc(mockAccountId).collection("products").doc(product.sku).set(product);
  }
  console.log(`3 produtos inseridos em /accounts/${mockAccountId}/products.`);

  // 4. Criar devoluções mockadas
  const today = new Date();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  const returns = [
    {
      id: "RET-001",
      accountId: mockAccountId,
      source: "anymarket",
      orderNumber: "MLB3249081234",
      invoiceNumber: "10293",
      customerName: "Carlos Silva",
      channel: "meli",
      returnType: "full",
      status: "pending_analysis",
      marketplace: "Mercado Livre",
      anymarketStatus: "IN_ANALYSIS",
      trackingCode: "RE829304812BR",
      reverseTrackingCode: "RE829304812BR",
      trackingCarrier: "Correios",
      trackingUrl: "https://rastreamento.correios.com.br/app/index.php?codigo=RE829304812BR",
      notes: "Produto chegou com embalagem danificada e arranhões na carcaça.",
      pendingIssue: "Aguardando perícia técnica para validar dano físico.",
      externalReturnId: "5123984123",
      returnDate: formatDateString(twoDaysAgo),
      lastWebhookReceivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      returnItems: [
        {
          id: "item-001",
          orderItemId: "order-item-1",
          sku: "PROD-001",
          title: "Camiseta Térmica Esportiva Dry Fit",
          quantity: 2
        },
        {
          id: "item-002",
          orderItemId: "order-item-2",
          sku: "PROD-002",
          title: "Tênis Running Performance Flex",
          quantity: 1
        }
      ],
      _analysisItems: [
        {
          id: "analysis-001",
          returnId: "RET-001",
          sku: "PROD-001",
          productName: "Camiseta Térmica Esportiva Dry Fit",
          ean: "7891234567890",
          expectedQty: 2,
          receivedQty: 2,
          status: "ok",
          problemTypes: [],
          notes: "Produto conferido e 100% OK para revenda.",
          addedManually: false,
          createdAt: twoDaysAgo.toISOString(),
          updatedAt: twoDaysAgo.toISOString()
        },
        {
          id: "analysis-002",
          returnId: "RET-001",
          sku: "PROD-002",
          productName: "Tênis Running Performance Flex",
          ean: "7891234567891",
          expectedQty: 1,
          receivedQty: 1,
          status: "problem",
          problemTypes: ["damaged", "used_product"],
          notes: "Tênis devolvido com solado sujo de terra e marcas severas de uso. Caixa original rasgada.",
          addedManually: false,
          createdAt: twoDaysAgo.toISOString(),
          updatedAt: twoDaysAgo.toISOString()
        }
      ],
      _photos: [
        {
          id: "photo-001",
          returnId: "RET-001",
          itemId: "analysis-002",
          type: "problem",
          storagePath: "returns/RET-001/problem_shoes.jpg",
          downloadUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop",
          createdAt: twoDaysAgo.toISOString()
        },
        {
          id: "photo-002",
          returnId: "RET-001",
          itemId: "analysis-002",
          type: "problem",
          storagePath: "returns/RET-001/shoes_sole.jpg",
          downloadUrl: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&auto=format&fit=crop",
          createdAt: twoDaysAgo.toISOString()
        }
      ],
      _history: [
        {
          id: "hist-001",
          returnId: "RET-001",
          action: "created",
          note: "Devolução criada automaticamente via webhook da AnyMarket.",
          createdAt: twoDaysAgo.toISOString()
        },
        {
          id: "hist-002",
          returnId: "RET-001",
          action: "status_changed",
          previousStatus: "on_the_way",
          newStatus: "pending_analysis",
          note: "Devolução recebida e encaminhada para a mesa de conferência.",
          createdAt: oneDayAgo.toISOString()
        }
      ]
    },
    {
      id: "RET-002",
      accountId: mockAccountId,
      source: "anymarket",
      orderNumber: "SHP981726354",
      invoiceNumber: "09841",
      customerName: "Mariana Costa",
      channel: "shopee",
      returnType: "flex",
      status: "resolved",
      marketplace: "Shopee",
      anymarketStatus: "CONCLUDED",
      trackingCode: "QP102938475BR",
      reverseTrackingCode: "QP102938475BR",
      trackingCarrier: "J&T Express",
      trackingUrl: "https://www.jtexpress.com.br/trajectory?billCode=QP102938475BR",
      notes: "Tamanho ficou menor do que o esperado. Devolvido e reembolsado pela plataforma.",
      externalReturnId: "RET-SHP-8821",
      returnDate: formatDateString(fiveDaysAgo),
      lastWebhookReceivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      returnItems: [
        {
          id: "item-003",
          orderItemId: "order-item-3",
          sku: "PROD-003",
          title: "Boné Ajustável Sport Aba Curva",
          quantity: 1
        }
      ],
      _analysisItems: [
        {
          id: "analysis-003",
          returnId: "RET-002",
          sku: "PROD-003",
          productName: "Boné Ajustável Sport Aba Curva",
          ean: "7891234567892",
          expectedQty: 1,
          receivedQty: 1,
          status: "ok",
          problemTypes: [],
          notes: "Produto recebido sem nenhuma marca de uso, tag original anexada. Retornado ao estoque.",
          addedManually: false,
          createdAt: fiveDaysAgo.toISOString(),
          updatedAt: fiveDaysAgo.toISOString()
        }
      ],
      _photos: [
        {
          id: "photo-003",
          returnId: "RET-002",
          itemId: "analysis-003",
          type: "package",
          storagePath: "returns/RET-002/package.jpg",
          downloadUrl: "https://images.unsplash.com/photo-1530745342582-0795f23ec976?w=600&auto=format&fit=crop",
          createdAt: fiveDaysAgo.toISOString()
        }
      ],
      _history: [
        {
          id: "hist-003",
          returnId: "RET-002",
          action: "created",
          note: "Importação via webhook da Shopee/AnyMarket concluída.",
          createdAt: fiveDaysAgo.toISOString()
        },
        {
          id: "hist-004",
          returnId: "RET-002",
          action: "resolved",
          note: "Devolução concluída e estorno efetuado.",
          createdAt: fiveDaysAgo.toISOString()
        }
      ]
    },
    {
      id: "RET-003",
      accountId: mockAccountId,
      source: "manual",
      orderNumber: "MLB123984712",
      invoiceNumber: "10452",
      customerName: "Felipe Souza",
      channel: "meli",
      returnType: "full",
      status: "on_the_way",
      notes: "Cliente desistiu da compra antes de abrir a embalagem. Retorno em trânsito.",
      returnDate: formatDateString(today),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      returnItems: [
        {
          id: "item-004",
          orderItemId: "order-item-4",
          sku: "PROD-001",
          title: "Camiseta Térmica Esportiva Dry Fit",
          quantity: 1
        }
      ],
      _history: [
        {
          id: "hist-005",
          returnId: "RET-003",
          action: "created",
          note: "Devolução manual registrada pelo operador.",
          createdAt: today.toISOString()
        }
      ]
    },
    {
      id: "RET-004",
      accountId: mockAccountId,
      source: "manual",
      orderNumber: "ECO-98412",
      invoiceNumber: "10512",
      customerName: "Amanda Lima",
      channel: "ecommerce",
      returnType: "ecommerce",
      status: "pending_return_invoice",
      notes: "Produto recebido na empresa. Aguardando emissão da nota fiscal de devolução para estornar pagamento.",
      pendingIssue: "Solicitar nota fiscal de devolução ao setor de faturamento.",
      returnDate: formatDateString(oneDayAgo),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      returnItems: [
        {
          id: "item-005",
          orderItemId: "order-item-5",
          sku: "PROD-002",
          title: "Tênis Running Performance Flex",
          quantity: 1
        }
      ],
      _analysisItems: [
        {
          id: "analysis-004",
          returnId: "RET-004",
          sku: "PROD-002",
          productName: "Tênis Running Performance Flex",
          ean: "7891234567891",
          expectedQty: 1,
          receivedQty: 1,
          status: "ok",
          problemTypes: [],
          notes: "Caixa amassada, mas produto sem defeitos ou marcas de uso.",
          addedManually: false,
          createdAt: oneDayAgo.toISOString(),
          updatedAt: oneDayAgo.toISOString()
        }
      ],
      _history: [
        {
          id: "hist-006",
          returnId: "RET-004",
          action: "created",
          note: "Registro manual no painel administrativo.",
          createdAt: oneDayAgo.toISOString()
        }
      ]
    },
    {
      id: "RET-005",
      accountId: mockAccountId,
      source: "anymarket",
      orderNumber: "MLB992837482",
      invoiceNumber: "10112",
      customerName: "Roberto Oliveira",
      channel: "meli",
      returnType: "full",
      status: "pending_dispute_or_refund",
      marketplace: "Mercado Livre",
      anymarketStatus: "DISPUTE",
      trackingCode: "RE778899001BR",
      reverseTrackingCode: "RE778899001BR",
      trackingCarrier: "Correios",
      trackingUrl: "https://rastreamento.correios.com.br/app/index.php?codigo=RE778899001BR",
      notes: "O cliente devolveu uma caixa com pedra no lugar do smartphone. Necessário abrir mediação.",
      pendingIssue: "Disputa aberta no ML. Enviadas as fotos e o laudo de abertura da embalagem.",
      externalReturnId: "599812398",
      returnDate: formatDateString(threeDaysAgo),
      lastWebhookReceivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      returnItems: [
        {
          id: "item-006",
          orderItemId: "order-item-6",
          sku: "PROD-003",
          title: "Boné Ajustável Sport Aba Curva",
          quantity: 2
        }
      ],
      _analysisItems: [
        {
          id: "analysis-005",
          returnId: "RET-005",
          sku: "PROD-003",
          productName: "Boné Ajustável Sport Aba Curva",
          ean: "7891234567892",
          expectedQty: 2,
          receivedQty: 0,
          status: "wrong_product",
          problemTypes: ["wrong_product"],
          notes: "Caixa original lacrada continha apenas uma pedra bruta e pedaços de papel.",
          addedManually: false,
          createdAt: threeDaysAgo.toISOString(),
          updatedAt: threeDaysAgo.toISOString()
        }
      ],
      _photos: [
        {
          id: "photo-004",
          returnId: "RET-005",
          itemId: "analysis-005",
          type: "wrong_product",
          storagePath: "returns/RET-005/stone.jpg",
          downloadUrl: "https://images.unsplash.com/photo-1582234372722-50d7ccc30ebd?w=600&auto=format&fit=crop",
          createdAt: threeDaysAgo.toISOString()
        }
      ],
      _history: [
        {
          id: "hist-007",
          returnId: "RET-005",
          action: "created",
          note: "Recepção automática de devolução em contestação.",
          createdAt: threeDaysAgo.toISOString()
        }
      ]
    }
  ];

  for (const ret of returns) {
    const { _analysisItems, _photos, _history, ...docData } = ret;
    const returnRef = db.collection("accounts").doc(mockAccountId).collection("returns").doc(ret.id);
    await returnRef.set(docData);

    if (_analysisItems) {
      for (const item of _analysisItems) {
        await returnRef.collection("analysisItems").doc(item.id).set(item);
      }
    }
    if (_photos) {
      for (const photo of _photos) {
        await returnRef.collection("photos").doc(photo.id).set(photo);
      }
    }
    if (_history) {
      for (const event of _history) {
        await returnRef.collection("history").doc(event.id).set(event);
      }
    }
  }
  console.log(`${returns.length} devoluções inseridas em /accounts/${mockAccountId}/returns com itens, fotos, histórico e analises.`);

  // 5. Criar vendas diárias mockadas (salesDaily) para os últimos 30 dias
  console.log("Inserindo vendas diárias dos últimos 30 dias para análise operacional...");
  const marketplaces = ["mercadolivre", "shopee"];
  for (let i = 0; i < 30; i++) {
    const saleDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = formatDateString(saleDate);

    for (const market of marketplaces) {
      // PROD-001 (Dry Fit T-Shirt) - Vendas diárias
      const q1 = Math.floor(Math.random() * 4) + 1; // 1 a 4
      const id1 = `${dateStr}_PROD-001_${market}`;
      await db.collection("accounts").doc(mockAccountId).collection("salesDaily").doc(id1).set({
        sku: "PROD-001",
        date: dateStr,
        marketplace: market,
        vendaQtd: q1,
        vendaValorBruto: q1 * 89.90,
        vendaValorLiquido: q1 * 72.00,
      });

      // PROD-002 (Running Shoes) - Vendas mais esporádicas
      const q2 = Math.random() > 0.4 ? 1 : 0; 
      if (q2 > 0) {
        const id2 = `${dateStr}_PROD-002_${market}`;
        await db.collection("accounts").doc(mockAccountId).collection("salesDaily").doc(id2).set({
          sku: "PROD-002",
          date: dateStr,
          marketplace: market,
          vendaQtd: q2,
          vendaValorBruto: q2 * 299.90,
          vendaValorLiquido: q2 * 240.00,
        });
      }

      // PROD-003 (Cap) - Vendas diárias maiores
      const q3 = Math.floor(Math.random() * 8) + 2; // 2 a 9
      const id3 = `${dateStr}_PROD-003_${market}`;
      await db.collection("accounts").doc(mockAccountId).collection("salesDaily").doc(id3).set({
        sku: "PROD-003",
        date: dateStr,
        marketplace: market,
        vendaQtd: q3,
        vendaValorBruto: q3 * 59.90,
        vendaValorLiquido: q3 * 48.00,
      });
    }
  }
  console.log("Vendas diárias mockadas inseridas com sucesso.");

  // 6. Criar inventário do Mercado Livre (ml_full_inventory)
  console.log("Inserindo snapshots de inventário do Mercado Livre (Fulfillment)...");
  const snapshotAt = Date.now();
  const mlbItems = [
    { id: "MLB3249081234", title: "Camiseta Térmica Esportiva Dry Fit", qty: 45 },
    { id: "MLB123984712", title: "Tênis Running Performance Flex", qty: 12 },
    { id: "MLB992837482", title: "Boné Ajustável Sport Aba Curva", qty: 150 }
  ];

  for (const item of mlbItems) {
    const snapshotId = `${item.id}_${snapshotAt}`;
    await db.collection("accounts").doc(mockAccountId).collection("ml_full_inventory").doc(snapshotId).set({
      item_id: item.id,
      title: item.title,
      available_quantity: item.qty,
      status: "active",
      logistic_type: "fulfillment",
      permalink: `https://produto.mercadolivre.com.br/${item.id}`,
      snapshot_at: snapshotAt,
    });
  }
  console.log("Snapshots de inventário inseridos.");

  console.log("--- Dados Mock Completos Inseridos com Sucesso! ---");
  process.exit(0);
}

main();
