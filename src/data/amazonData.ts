
export interface AmazonTier {
    limit: number;
    pct: number;
}

export interface AmazonCategory {
    name: string;
    feePct?: number;
    minFee: number;
    tiers?: AmazonTier[]; // Tiers: [ { limit: 100, pct: 15 }, { limit: Infinity, pct: 10 } ]
}

/**
 * Categorias da Amazon e suas respectivas comissões.
 * @see https://sellercentral.amazon.com.br/help/hub/reference/200336920
 */
export const AMAZON_CATEGORIES: AmazonCategory[] = [
    {
        name: "Acessórios para eletrônicos e para PC",
        minFee: 1.00,
        tiers: [
            { limit: 100, pct: 15 },
            { limit: Infinity, pct: 10 }
        ]
    },
    { name: "Aparelhos para cuidados pessoais", feePct: 12, minFee: 1.00 },
    { name: "Bagagem, bolsas e acessórios de viagem", feePct: 14, minFee: 1.00 },
    { name: "Bebidas alcoólicas", feePct: 11, minFee: 1.00 },
    { name: "Beleza", feePct: 13, minFee: 1.00 },
    { name: "Brinquedos e jogos", feePct: 12, minFee: 1.00 },
    { name: "Câmera e fotografia", feePct: 11, minFee: 1.00 },
    { name: "Casa", feePct: 12, minFee: 1.00 },
    { name: "Celulares", feePct: 11, minFee: 1.00 },
    { name: "Comidas e bebidas", feePct: 10, minFee: 1.00 },
    { name: "Computadores", feePct: 12, minFee: 1.00 },
    { name: "Cozinha", feePct: 12, minFee: 1.00 },
    { name: "Eletrodomésticos de linha branca", feePct: 11, minFee: 1.00 },
    { name: "Eletrônicos portáteis", feePct: 13, minFee: 1.00 },
    { name: "Esportes, aventura e lazer", feePct: 12, minFee: 1.00 },
    { name: "Indústria e Ciência", feePct: 12, minFee: 2.00 },
    { name: "Instrumentos musicais e acessórios", feePct: 12, minFee: 1.00 },
    { name: "Joias", feePct: 14, minFee: 1.00 },
    { name: "Livros", feePct: 15, minFee: 1.00 },
    {
        name: "Móveis",
        minFee: 1.00,
        tiers: [
            { limit: 200, pct: 15 },
            { limit: Infinity, pct: 10 }
        ]
    },
    { name: "Música", feePct: 15, minFee: 1.00 },
    { name: "Papelaria e escritório", feePct: 13, minFee: 1.00 },
    { name: "Peças e acessórios automotivos", feePct: 12, minFee: 1.00 },
    { name: "Plantas e jardim", feePct: 12, minFee: 1.00 },
    { name: "Pneus e rodas", feePct: 10, minFee: 1.00 },
    { name: "Produtos de beleza de luxo", feePct: 14, minFee: 1.00 },
    { name: "Produtos para animais de estimação", feePct: 12, minFee: 1.00 },
    { name: "Produtos para bebês", feePct: 12, minFee: 1.00 },
    { name: "Reforma de casa", feePct: 11, minFee: 1.00 },
    { name: "Relógios", feePct: 13, minFee: 1.00 },
    { name: "Roupas e acessórios", feePct: 14, minFee: 1.00 },
    { name: "Saúde e cuidado pessoal", feePct: 12, minFee: 1.00 },
    { name: "Sapatos e óculos escuros", feePct: 14, minFee: 1.00 },
    { name: "TV, áudio e cinema em casa", feePct: 10, minFee: 1.00 },
    { name: "Vídeo e DVD", feePct: 15, minFee: 1.00 },
    { name: "Videogames e consoles", feePct: 11, minFee: 1.00 },
    { name: "Outros", feePct: 15, minFee: 1.00 },
];

export const AMAZON_FBA_STORAGE_SIZES = [
    { id: 'pp', name: 'PP – Muito pequeno', volume: 500, label: 'Até 1.000 cm³', dims: '10 × 10 × 10 cm', ex: 'cabos, adaptadores, capas simples, fones' },
    { id: 'p', name: 'P – Pequeno', volume: 2500, label: '1.001 a 4.000 cm³', dims: '20 × 10 × 20 cm', ex: 'livros finos, cosméticos, eletrônicos compactos' },
    { id: 'm', name: 'M – Médio compacto', volume: 7000, label: '4.001 a 9.999 cm³', dims: '25 × 20 × 20 cm', ex: 'calçados, kits de produtos, utensílios domésticos' },
    { id: 'g', name: 'G – Médio padrão', volume: 15000, label: '10.000 a 20.000 cm³', dims: '40 × 25 × 20 cm', ex: 'mochilas, eletroportáteis pequenos, organizadores' },
    { id: 'gg', name: 'GG – Grande', volume: 30000, label: '20.001 a 40.000 cm³', dims: '50 × 40 × 20 cm', ex: 'liquidificador, airfryer pequena, kits volumosos' },
    { id: 'xg', name: 'XG – Muito grande', volume: 60000, label: 'Acima de 40.000 cm³', dims: '60 × 50 × 20 cm', ex: 'eletrodomésticos, caixas grandes, produtos volumosos' },
];

/**
 * Custos logísticos da Amazon (DBA e FBA).
 * @see DBA: https://sellercentral.amazon.com.br/help/hub/reference/201382050
 * @see FBA: https://sellercentral.amazon.com.br/help/hub/reference/G200209150
 * @see FBAOnsite: https://sellercentral.amazon.com.br/help/hub/reference/GSCSJT23SEAKNXAN
 */
export const AMAZON_LOGISTICS = {
    dba: {
        getCost: (price: number, weight: number) => {
            if (price < 30) return 4.50;
            if (price < 50) return 6.50;
            if (price < 79) return 6.75;

            // Price >= 79, weight becomes relevant
            if (price < 200) {
                // Determine price column
                let colIdx = 0; // 0: 79-99.99, 1: 100-119.99, 2: 120-149.99, 3: 150-199.99
                if (price < 100) colIdx = 0;
                else if (price < 120) colIdx = 1;
                else if (price < 150) colIdx = 2;
                else colIdx = 3;

                const matrix = [
                    [11.95, 13.95, 15.95, 17.95], // 0-250g
                    [12.85, 15.00, 17.15, 19.30], // 250-500g
                    [13.45, 15.70, 17.95, 20.20], // 500g-1kg
                    [14.00, 16.35, 18.75, 21.10], // 1-2kg
                    [14.95, 17.45, 19.95, 22.40], // 2-3kg
                    [16.15, 18.85, 21.55, 24.20], // 3-4kg
                    [17.00, 19.90, 22.75, 25.60], // 4-5kg
                    [25.00, 30.00, 34.00, 38.00], // 5-6kg
                    [26.00, 31.00, 35.00, 39.00], // 6-7kg
                    [27.00, 32.00, 36.00, 40.00], // 7-8kg
                    [28.00, 33.00, 37.00, 41.00], // 8-9kg
                    [39.50, 46.00, 52.75, 59.00]  // 9-10kg
                ];

                if (weight <= 0.25) return matrix[0][colIdx];
                if (weight <= 0.5) return matrix[1][colIdx];
                if (weight <= 1.0) return matrix[2][colIdx];
                if (weight <= 2.0) return matrix[3][colIdx];
                if (weight <= 3.0) return matrix[4][colIdx];
                if (weight <= 4.0) return matrix[5][colIdx];
                if (weight <= 5.0) return matrix[6][colIdx];
                if (weight <= 6.0) return matrix[7][colIdx];
                if (weight <= 7.0) return matrix[8][colIdx];
                if (weight <= 8.0) return matrix[9][colIdx];
                if (weight <= 9.0) return matrix[10][colIdx];
                if (weight <= 10.0) return matrix[11][colIdx];

                // Kg adicional
                const baseWeight = 10;
                const basePrice = matrix[11][colIdx];
                const extraKgCharge = colIdx === 3 ? 3.50 : 3.05;
                return basePrice + Math.ceil(weight - baseWeight) * extraKgCharge;
            } else {
                // Price >= 200, use Column (4) Centro-Oeste, Norte e Nordeste
                const matrix200 = [
                    20.45, // 0-250g
                    20.95, // 250-500g
                    21.95, // 500g-1kg
                    23.45, // 1-2kg
                    24.45, // 2-3kg
                    25.95, // 3-4kg
                    27.95, // 4-5kg
                    36.95, // 5-6kg
                    39.45, // 6-7kg
                    40.45, // 7-8kg
                    46.95, // 8-9kg
                    65.95  // 9-10kg
                ];

                if (weight <= 0.25) return matrix200[0];
                if (weight <= 0.5) return matrix200[1];
                if (weight <= 1.0) return matrix200[2];
                if (weight <= 2.0) return matrix200[3];
                if (weight <= 3.0) return matrix200[4];
                if (weight <= 4.0) return matrix200[5];
                if (weight <= 5.0) return matrix200[6];
                if (weight <= 6.0) return matrix200[7];
                if (weight <= 7.0) return matrix200[8];
                if (weight <= 8.0) return matrix200[9];
                if (weight <= 9.0) return matrix200[10];
                if (weight <= 10.0) return matrix200[11];

                const baseWeight = 10;
                const basePrice = matrix200[11];
                const extraKgCharge = 4.00;
                return basePrice + Math.ceil(weight - baseWeight) * extraKgCharge;
            }
        }
    },
    fba: {
        getFulfillment: (price: number, weight: number) => {
            if (price < 30) return 5.65;
            if (price < 50) return 5.85;
            if (price < 79) return 6.05;

            // Price >= 79, weight becomes relevant
            // Columns: 0: 79-99.99, 1: 100-119.99, 2: 120-149.99, 3: 150-199.99, 4: >= 200
            let colIdx = 0;
            if (price < 100) colIdx = 0;
            else if (price < 120) colIdx = 1;
            else if (price < 150) colIdx = 2;
            else if (price < 200) colIdx = 3;
            else colIdx = 4;

            const matrix = [
                /* 0-100g */[10.05, 12.05, 14.05, 15.05, 15.55],
                /* 100-200g */[10.45, 12.45, 14.45, 15.45, 16.05],
                /* 200-300g */[10.95, 12.95, 14.95, 15.95, 16.55],
                /* 300-400g */[11.45, 13.45, 15.45, 16.95, 17.15],
                /* 400-500g */[11.95, 13.95, 15.95, 17.05, 17.85],
                /* 500-750g */[12.05, 14.05, 16.05, 18.45, 18.55],
                /* 750g-1kg */[12.45, 14.45, 16.45, 19.05, 19.25],
                /* 1-1.5kg */[12.95, 14.95, 16.95, 19.45, 20.35],
                /* 1.5-2kg */[13.05, 15.05, 17.05, 19.95, 21.35],
                /* 2-3kg */[14.05, 16.05, 18.05, 20.05, 22.35],
                /* 3-4kg */[15.05, 17.05, 19.05, 21.95, 23.35],
                /* 4-5kg */[16.05, 18.05, 20.05, 22.95, 24.35],
                /* 5-6kg */[24.05, 27.05, 29.05, 30.05, 30.35],
                /* 6-7kg */[25.05, 28.05, 30.05, 31.05, 33.35],
                /* 7-8kg */[26.05, 29.05, 31.05, 32.05, 35.35],
                /* 8-9kg */[27.05, 30.05, 32.05, 33.05, 37.35],
                /* 9-10kg */[35.05, 40.05, 46.05, 51.05, 51.35]
            ];

            let rowIdx = 0;
            if (weight <= 0.1) rowIdx = 0;
            else if (weight <= 0.2) rowIdx = 1;
            else if (weight <= 0.3) rowIdx = 2;
            else if (weight <= 0.4) rowIdx = 3;
            else if (weight <= 0.5) rowIdx = 4;
            else if (weight <= 0.75) rowIdx = 5;
            else if (weight <= 1.0) rowIdx = 6;
            else if (weight <= 1.5) rowIdx = 7;
            else if (weight <= 2.0) rowIdx = 8;
            else if (weight <= 3.0) rowIdx = 9;
            else if (weight <= 4.0) rowIdx = 10;
            else if (weight <= 5.0) rowIdx = 11;
            else if (weight <= 6.0) rowIdx = 12;
            else if (weight <= 7.0) rowIdx = 13;
            else if (weight <= 8.0) rowIdx = 14;
            else if (weight <= 9.0) rowIdx = 15;
            else if (weight <= 10.0) rowIdx = 16;
            else {
                // Additional Kg logic
                const basePrice = matrix[16][colIdx];
                const extraKgCharge = colIdx >= 3 ? 3.50 : 3.05;
                return basePrice + Math.ceil(weight - 10) * extraKgCharge;
            }

            return matrix[rowIdx][colIdx];
        },
        getStorage: (volumeCm3: number) => {
            const m3 = volumeCm3 / 1000000;
            const rate = volumeCm3 < 10000 ? 75.00 : 37.50;
            return m3 * rate;
        }
    },
    fbaOnsite: {
        getCost: (price: number, weight: number) => {
            if (price < 30) return 6.25;
            if (price < 50) return 6.50;
            if (price < 79) return 6.75;

            // Price >= 79, weight becomes relevant
            let colIdx = 0;
            if (price < 100) colIdx = 0;
            else if (price < 120) colIdx = 1;
            else if (price < 150) colIdx = 2;
            else if (price < 200) colIdx = 3;
            else colIdx = 4;

            const matrix = [
                [11.95, 13.95, 15.95, 17.95, 19.90], // 0-250g
                [12.85, 15.00, 17.15, 19.30, 20.40], // 250-500g
                [13.45, 15.70, 17.95, 20.20, 21.40], // 500g-1kg
                [14.00, 16.35, 18.75, 21.10, 22.90], // 1-2kg
                [14.95, 17.45, 19.95, 22.40, 23.90], // 2-3kg
                [16.15, 18.85, 21.55, 24.20, 24.90], // 3-4kg
                [17.00, 19.90, 22.75, 25.60, 25.90], // 4-5kg
                [25.00, 30.00, 34.00, 38.00, 41.40], // 5-6kg
                [26.00, 31.00, 35.00, 39.00, 41.90], // 6-7kg
                [27.00, 32.00, 36.00, 40.00, 41.90], // 7-8kg
                [28.00, 33.00, 37.00, 41.00, 41.90], // 8-9kg
                [39.50, 46.00, 52.75, 59.00, 65.90]  // 9-10kg
            ];

            let rowIdx = 0;
            if (weight <= 0.25) rowIdx = 0;
            else if (weight <= 0.5) rowIdx = 1;
            else if (weight <= 1.0) rowIdx = 2;
            else if (weight <= 2.0) rowIdx = 3;
            else if (weight <= 3.0) rowIdx = 4;
            else if (weight <= 4.0) rowIdx = 5;
            else if (weight <= 5.0) rowIdx = 6;
            else if (weight <= 6.0) rowIdx = 7;
            else if (weight <= 7.0) rowIdx = 8;
            else if (weight <= 8.0) rowIdx = 9;
            else if (weight <= 9.0) rowIdx = 10;
            else if (weight <= 10.0) rowIdx = 11;
            else {
                // Extra Kg logic
                const basePrice = matrix[11][colIdx];
                const extraKgCharge = colIdx === 3 ? 3.50 : (colIdx === 4 ? 4.00 : 3.05);
                return basePrice + Math.ceil(weight - 10) * extraKgCharge;
            }

            return matrix[rowIdx][colIdx];
        }
    }
};
