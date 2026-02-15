export interface MeliCategory {
    name: string;
    classic: number;
    premium: number;
}

/**
 * Categorias do Mercado Livre e suas respectivas comissões (Clássico e Premium).
 * @see https://www.mercadolivre.com.br/ajuda/quanto-custa-vender-um-produto_1338
 */
export const MELI_CATEGORIES: MeliCategory[] = [
    { name: "Acessórios para Veículos", classic: 12, premium: 17 },
    { name: "Agro", classic: 11.5, premium: 16.5 },
    { name: "Alimentos e Bebidas", classic: 14, premium: 19 },
    { name: "Antiguidades e Coleções", classic: 11.5, premium: 16.5 },
    { name: "Arte, Papelaria & Armarinho", classic: 11.5, premium: 16.5 },
    { name: "Bebês", classic: 14, premium: 19 },
    { name: "Beleza & Cuidado Pessoal", classic: 14, premium: 19 },
    { name: "Brinquedos e Hobbies", classic: 11.5, premium: 16.5 },
    { name: "Calçados, Roupas & Bolsas", classic: 14, premium: 19 },
    { name: "Câmeras & Acessórios", classic: 11, premium: 16 },
    { name: "Casa, Móveis & Decoração", classic: 11.5, premium: 16.5 },
    { name: "Construção", classic: 11.5, premium: 16.5 },
    { name: "Eletrodomésticos", classic: 11, premium: 16 },
    { name: "Eletrônicos, Áudio & Vídeo", classic: 13, premium: 18 },
    { name: "Esportes & Fitness", classic: 14, premium: 19 },
    { name: "Festas & Lembrancinhas", classic: 11.5, premium: 16.5 },
    { name: "Games", classic: 13, premium: 18 },
    { name: "Informática / Celulares / Notebooks", classic: 11, premium: 16 },
    { name: "Indústria & Comércio", classic: 12, premium: 17 },
    { name: "Ingressos", classic: 11.5, premium: 16.5 },
    { name: "Instrumentos Musicais", classic: 11.5, premium: 16.5 },
    { name: "Joias & Relógios", classic: 12.5, premium: 17.5 },
    { name: "Livros, Revistas & Comics", classic: 12, premium: 17 },
    { name: "Música, Filmes & Seriados", classic: 12, premium: 17 },
    { name: "Pet Shop", classic: 12.5, premium: 17.5 },
    { name: "Saúde", classic: 12, premium: 17 }
];

/**
 * Calcula a tarifa fixa por venda no Mercado Livre (Anúncios < R$ 79).
 * De acordo com a tabela atualizada.
 * @see Tarifafixa: https://www.mercadolivre.com.br/ajuda/quanto-custa-vender-um-produto_1338
 */
export const getMeliFlatFee = (price: number, specialCategory?: string): number => {
    if (price >= 79 || specialCategory === 'super') return 0;

    if (specialCategory === 'books') {
        if (price < 6) return Number((price / 2).toFixed(2));
        if (price < 29) return 3.00;
        if (price < 50) return 3.50;
        if (price < 79) return 4.00;
    }

    if (price < 12.50) return Number((price / 2).toFixed(2));
    if (price < 29.00) return 6.25;
    if (price < 50.00) return 6.50;
    return 6.75; // Entre 50 e 79
};

/**
 * Custos de armazenamento diário no Full (MELI).
 * @see https://www.mercadolivre.com.br/ajuda/custo-armazenamento-diario_34563
 */
export const MELI_FULL_STORAGE_SIZES = [
    { id: 'pequeno', name: 'Pequeno', dailyCost: 0.007, dims: 'Até 12 x 15 x 25 cm', weight: 'Até 18 kg', ex: 'Ex: tablet' },
    { id: 'medio', name: 'Médio', dailyCost: 0.015, dims: 'Até 28 x 36 x 51 cm', weight: 'Até 18 kg', ex: 'Ex: cafeteira' },
    { id: 'grande', name: 'Grande', dailyCost: 0.050, dims: 'Até 60 x 60 x 70 cm', weight: 'Até 18 kg', ex: 'Ex: micro-ondas' },
    { id: 'extragrande', name: 'Extragrande', dailyCost: 0.107, dims: 'Acima de 60 x 60 x 70 cm ou > 18 kg', weight: 'Acima de 18 kg', ex: 'Ex: balde de tinta' },
];

/**
 * Custos de armazenamento diário para produtos de Supermercado no Full (MELI).
 */
export const MELI_SUPER_STORAGE_SIZES = [
    { id: 'pequeno', name: 'Pequeno', dailyCost: 0.000, dims: 'Até 12 x 15 x 25 cm', weight: 'Até 18 kg', ex: 'Ex: barra de cereal' },
    { id: 'medio', name: 'Médio', dailyCost: 0.000, dims: 'Até 28 x 36 x 51 cm', weight: 'Até 18 kg', ex: 'Ex: garrafa de refrigerante' },
    { id: 'grande', name: 'Grande', dailyCost: 0.014, dims: 'Até 60 x 60 x 70 cm', weight: 'Até 18 kg', ex: 'Ex: balde' },
    { id: 'extragrande', name: 'Extragrande', dailyCost: 0.025, dims: 'Acima de 60 x 60 x 70 cm ou > 18 kg', weight: 'Acima de 18 kg', ex: 'Ex: vassoura' },
];

/**
 * Custos logísticos do MELI.
 * @see Padrao: https://www.mercadolivre.com.br/ajuda/custos-envio-reputacao-verde-sem-reputacao_48392
 * @see Livros: https://www.mercadolivre.com.br/ajuda/48559
 * @see Super: https://www.mercadolivre.com.br/ajuda/48556
 * @see OutrasEspeciais: https://www.mercadolivre.com.br/ajuda/48560
 * @see Usados: https://www.mercadolivre.com.br/ajuda/48565
 * @see Pets: https://www.mercadolivre.com.br/ajuda/48558
 */
export const MELI_LOGISTICS = {
    full_coletas: {
        getCost: (price: number, weight: number, specialCategory?: string) => {
            // Rule: Products < R$ 19 pay at most half the price
            const maxCostForLowPrice = price < 19 ? price / 2 : Infinity;

            // Determine price column index
            // 0: 0-18.99, 1: 19-48.99, 2: 49-78.99, 3: 79-99.99, 4: 100-119.99, 5: 120-149.99, 6: 150-199.99, 7: 200+
            let colIdx = 0;
            if (price < 19) colIdx = 0;
            else if (price < 49) colIdx = 1;
            else if (price < 79) colIdx = 2;
            else if (price < 100) colIdx = 3;
            else if (price < 120) colIdx = 4;
            else if (price < 150) colIdx = 5;
            else if (price < 200) colIdx = 6;
            else colIdx = 7;

            // Matrix from image
            const standardMatrix = [
                /* Até 0,3 kg */[5.65, 6.55, 7.75, 12.35, 14.35, 16.45, 18.45, 20.95],
                /* 0,3 a 0,5 kg */[5.95, 6.65, 7.85, 13.25, 15.45, 17.65, 19.85, 22.55],
                /* 0,5 a 1 kg */[6.05, 6.75, 7.95, 13.85, 16.15, 18.45, 20.75, 23.65],
                /* 1 a 1,5 kg */[6.15, 6.85, 8.05, 14.15, 16.45, 18.85, 21.15, 24.65],
                /* 1,5 a 2 kg */[6.25, 6.95, 8.15, 14.45, 16.85, 19.25, 21.65, 24.65],
                /* 2 a 3 kg */[6.35, 7.95, 8.55, 15.75, 18.35, 21.05, 23.65, 26.25],
                /* 3 a 4 kg */[6.45, 8.15, 8.95, 17.05, 19.85, 22.65, 25.55, 28.35],
                /* 4 a 5 kg */[6.55, 8.35, 9.75, 18.45, 21.55, 24.65, 27.75, 30.75],
                /* 5 a 6 kg */[6.65, 8.55, 9.95, 25.45, 28.55, 32.65, 35.75, 39.75],
                /* 6 a 7 kg */[6.75, 8.75, 10.15, 27.05, 31.05, 36.05, 40.05, 44.05],
                /* 7 a 8 kg */[6.85, 8.95, 10.35, 28.85, 33.65, 38.45, 43.25, 48.05],
                /* 8 a 9 kg */[6.95, 9.15, 10.55, 29.65, 34.55, 39.55, 44.45, 49.35],
                /* 9 a 11 kg */[7.05, 9.55, 10.95, 41.25, 48.05, 54.95, 61.75, 68.65],
                /* 11 a 13 kg */[7.15, 9.95, 11.35, 42.15, 49.25, 56.25, 63.25, 70.25],
                /* 13 a 15 kg */[7.25, 10.15, 11.55, 45.05, 52.45, 59.95, 67.45, 74.95],
                /* 15 a 17 kg */[7.35, 10.35, 11.75, 48.55, 56.05, 63.55, 70.75, 78.65],
                /* 17 a 20 kg */[7.45, 10.55, 11.95, 54.75, 63.85, 72.95, 82.05, 91.15],
                /* 20 a 25 kg */[7.65, 10.95, 12.15, 64.05, 75.05, 84.75, 95.35, 105.95],
                /* 25 a 30 kg */[7.75, 11.15, 12.35, 65.95, 75.45, 85.55, 96.25, 106.95],
                /* 30 a 40 kg */[7.85, 11.35, 12.55, 67.75, 78.95, 88.95, 99.15, 107.05],
                /* 40 a 50 kg */[7.95, 11.55, 12.75, 70.25, 81.05, 92.05, 102.55, 110.75],
                /* 50 a 60 kg */[8.05, 11.75, 12.95, 74.95, 86.45, 98.15, 109.35, 118.15],
                /* 60 a 70 kg */[8.15, 11.95, 13.15, 80.25, 92.95, 105.05, 117.15, 126.55],
                /* 70 a 80 kg */[8.25, 12.15, 13.35, 83.95, 97.05, 109.85, 122.45, 132.55],
                /* 80 a 90 kg */[8.35, 12.35, 13.55, 93.25, 107.45, 122.05, 136.05, 146.95],
                /* 90 a 100 kg */[8.45, 12.55, 13.75, 106.55, 123.95, 139.55, 155.55, 167.95],
                /* 100 a 125 kg */[8.55, 12.75, 13.95, 119.25, 138.05, 156.05, 173.95, 187.95],
                /* 125 a 150 kg */[8.65, 12.75, 14.15, 126.55, 146.15, 165.65, 184.65, 199.45],
                /* Mais de 150 kg */[8.75, 12.75, 14.35, 166.15, 192.45, 217.55, 242.55, 261.95]
            ];

            const specialMatrix = [
                /* Até 0,3 kg */[5.65, 6.55, 7.75, 18.53, 21.53, 24.68, 27.68, 31.43],
                /* 0,3 a 0,5 kg */[5.95, 6.65, 7.85, 19.88, 23.18, 26.48, 29.78, 33.83],
                /* 0,5 a 1 kg */[6.05, 6.75, 7.95, 20.78, 24.23, 27.68, 31.13, 35.48],
                /* 1 a 1,5 kg */[6.15, 6.85, 8.05, 21.23, 24.68, 28.28, 31.73, 36.98],
                /* 1,5 a 2 kg */[6.25, 6.95, 8.15, 21.68, 25.28, 28.88, 32.48, 36.98],
                /* 2 a 3 kg */[6.35, 7.95, 8.55, 23.63, 27.53, 31.58, 35.48, 39.38],
                /* 3 a 4 kg */[6.45, 8.15, 8.95, 25.58, 29.78, 33.98, 38.33, 42.53],
                /* 4 a 5 kg */[6.55, 8.35, 9.75, 27.68, 32.33, 36.98, 41.63, 46.13],
                /* 5 a 6 kg */[6.65, 8.55, 9.95, 38.18, 42.83, 48.98, 53.63, 59.63],
                /* 6 a 7 kg */[6.75, 8.75, 10.15, 40.58, 46.58, 54.08, 60.08, 66.08],
                /* 7 a 8 kg */[6.85, 8.95, 10.35, 43.28, 50.48, 57.68, 64.88, 72.08],
                /* 8 a 9 kg */[6.95, 9.15, 10.55, 44.48, 51.83, 59.33, 66.68, 74.03],
                /* 9 a 11 kg */[7.05, 9.55, 10.95, 61.88, 72.08, 82.43, 92.63, 102.98],
                /* 11 a 13 kg */[7.15, 9.95, 11.35, 63.23, 73.88, 84.38, 94.88, 105.38],
                /* 13 a 15 kg */[7.25, 10.15, 11.55, 67.58, 78.68, 89.93, 101.18, 112.43],
                /* 15 a 17 kg */[7.35, 10.35, 11.75, 72.83, 84.08, 95.33, 106.13, 117.98],
                /* 17 a 20 kg */[7.45, 10.55, 11.95, 82.13, 95.78, 109.43, 123.08, 136.73],
                /* 20 a 25 kg */[7.65, 10.95, 12.15, 96.08, 112.58, 127.13, 143.03, 158.93],
                /* 25 a 30 kg */[7.75, 11.15, 12.35, 98.93, 113.18, 128.33, 144.38, 160.43],
                /* 30 a 40 kg */[7.85, 11.35, 12.55, 101.63, 118.43, 133.43, 148.73, 160.58],
                /* 40 a 50 kg */[7.95, 11.55, 12.75, 105.38, 121.58, 138.08, 153.83, 166.13],
                /* 50 a 60 kg */[8.05, 11.75, 12.95, 112.43, 129.68, 147.23, 164.03, 177.23],
                /* 60 a 70 kg */[8.15, 11.95, 13.15, 120.38, 139.43, 157.58, 175.73, 189.83],
                /* 70 a 80 kg */[8.25, 12.15, 13.35, 125.93, 145.58, 164.78, 183.68, 198.38],
                /* 80 a 90 kg */[8.35, 12.35, 13.55, 139.88, 161.18, 183.08, 204.08, 220.43],
                /* 90 a 100 kg */[8.45, 12.55, 13.75, 159.83, 185.93, 209.33, 233.33, 251.93],
                /* 100 a 125 kg */[8.55, 12.75, 13.95, 178.88, 207.08, 234.08, 260.93, 281.93],
                /* 125 a 150 kg */[8.65, 12.75, 14.15, 189.83, 219.23, 248.48, 276.98, 299.18],
                /* Mais de 150 kg */[8.75, 12.75, 14.35, 249.23, 288.68, 326.33, 363.83, 392.93]
            ];

            const usedMatrix = [
                /* Até 0,3 kg */[8.07, 9.36, 11.07, 41.90],
                /* 0,3 a 0,5 kg */[8.50, 9.50, 11.21, 45.10],
                /* 0,5 a 1 kg */[8.64, 9.64, 11.36, 47.30],
                /* 1 a 1,5 kg */[8.79, 9.79, 11.50, 49.30],
                /* 1,5 a 2 kg */[8.93, 9.93, 11.64, 49.30],
                /* 2 a 3 kg */[9.07, 11.36, 12.21, 52.50],
                /* 3 a 4 kg */[9.21, 11.64, 12.79, 56.70],
                /* 4 a 5 kg */[9.36, 11.93, 13.93, 61.50],
                /* 5 a 6 kg */[9.50, 12.21, 14.21, 79.50],
                /* 6 a 7 kg */[9.64, 12.50, 14.50, 88.10],
                /* 7 a 8 kg */[9.79, 12.79, 14.79, 96.10],
                /* 8 a 9 kg */[9.93, 13.07, 15.07, 98.70],
                /* 9 a 11 kg */[10.07, 13.64, 15.64, 137.30],
                /* 11 a 13 kg */[10.21, 14.21, 16.21, 140.50],
                /* 13 a 15 kg */[10.36, 14.50, 16.50, 149.90],
                /* 15 a 17 kg */[10.50, 14.79, 16.79, 157.30],
                /* 17 a 20 kg */[10.64, 15.07, 17.07, 182.30],
                /* 20 a 25 kg */[10.93, 15.64, 17.36, 211.90],
                /* 25 a 30 kg */[11.07, 15.93, 17.64, 213.90],
                /* 30 a 40 kg */[11.21, 16.21, 17.93, 214.10],
                /* 40 a 50 kg */[11.36, 16.50, 18.21, 221.50],
                /* 50 a 60 kg */[11.50, 16.79, 18.50, 236.30],
                /* 60 a 70 kg */[11.64, 17.07, 18.79, 253.10],
                /* 70 a 80 kg */[11.79, 17.36, 19.07, 264.50],
                /* 80 a 90 kg */[11.93, 17.64, 19.36, 293.90],
                /* 90 a 100 kg */[12.07, 17.93, 19.64, 335.90],
                /* 100 a 125 kg */[12.21, 18.21, 19.93, 375.90],
                /* 125 a 150 kg */[12.36, 18.21, 20.21, 398.90],
                /* Mais de 150 kg */[12.50, 18.21, 20.50, 523.90]
            ];

            const petsMatrix = [
                /* Até 0,3 kg */[5.65, 6.55, 7.75, 10.48, 20.95],
                /* 0,3 a 0,5 kg */[5.95, 6.65, 7.85, 11.28, 22.55],
                /* 0,5 a 1 kg */[6.05, 6.75, 7.95, 11.83, 23.65],
                /* 1 a 1,5 kg */[6.15, 6.85, 8.05, 12.33, 24.65],
                /* 1,5 a 2 kg */[6.25, 6.95, 8.15, 12.33, 24.65],
                /* 2 a 3 kg */[6.35, 7.95, 8.55, 13.13, 26.25],
                /* 3 a 4 kg */[6.45, 8.15, 8.95, 14.18, 28.35],
                /* 4 a 5 kg */[6.55, 8.35, 9.75, 15.38, 30.75],
                /* 5 a 6 kg */[6.65, 8.55, 9.95, 19.88, 39.75],
                /* 6 a 7 kg */[6.75, 8.75, 10.15, 22.03, 44.05],
                /* 7 a 8 kg */[6.85, 8.95, 10.35, 24.03, 48.05],
                /* 8 a 9 kg */[6.95, 9.15, 10.55, 24.68, 49.35],
                /* 9 a 11 kg */[7.05, 9.55, 10.95, 34.33, 68.65],
                /* 11 a 13 kg */[7.15, 9.95, 11.35, 35.13, 70.25],
                /* 13 a 15 kg */[7.25, 10.15, 11.55, 37.48, 74.95],
                /* 15 a 17 kg */[7.35, 10.35, 11.75, 39.33, 78.65],
                /* 17 a 20 kg */[7.45, 10.55, 11.95, 45.58, 91.15],
                /* 20 a 25 kg */[7.65, 10.95, 12.15, 52.98, 105.95],
                /* 25 a 30 kg */[7.75, 11.15, 12.35, 53.48, 106.95],
                /* 30 a 40 kg */[7.85, 11.35, 12.55, 53.53, 107.05],
                /* 40 a 50 kg */[7.95, 11.55, 12.75, 55.38, 110.75],
                /* 50 a 60 kg */[8.05, 11.75, 12.95, 59.08, 118.15],
                /* 60 a 70 kg */[8.15, 11.95, 13.15, 63.28, 126.55],
                /* 70 a 80 kg */[8.25, 12.15, 13.35, 66.13, 132.25],
                /* 80 a 90 kg */[8.35, 12.35, 13.55, 73.48, 146.95],
                /* 90 a 100 kg */[8.45, 12.55, 13.75, 83.98, 167.95],
                /* 100 a 125 kg */[8.55, 12.75, 13.95, 93.98, 187.95],
                /* 125 a 150 kg */[8.65, 12.75, 14.15, 99.73, 199.45],
                /* Mais de 150 kg */[8.75, 12.75, 14.35, 130.98, 261.95]
            ];

            const booksMatrix = [
                /* Até 0,3 kg */[2.83, 3.28, 3.88, 12.35, 14.35, 16.45, 18.45, 20.95],
                /* 0,3 a 0,5 kg */[2.98, 3.33, 3.93, 13.25, 15.45, 17.65, 19.85, 22.55],
                /* 0,5 a 1 kg */[3.03, 3.38, 3.98, 13.85, 16.15, 18.45, 20.75, 23.65],
                /* 1 a 1,5 kg */[3.08, 3.43, 4.03, 14.15, 16.45, 18.85, 21.15, 24.65],
                /* 1,5 a 2 kg */[3.13, 3.48, 4.08, 14.45, 16.85, 19.25, 21.65, 24.65],
                /* 2 a 3 kg */[3.18, 3.98, 4.28, 15.75, 18.35, 21.05, 23.65, 26.25],
                /* 3 a 4 kg */[3.23, 4.08, 4.48, 17.05, 19.85, 22.65, 25.55, 28.35],
                /* 4 a 5 kg */[3.28, 4.18, 4.88, 18.45, 21.55, 24.65, 27.75, 30.75],
                /* 5 a 6 kg */[3.33, 4.28, 4.98, 25.45, 28.55, 32.65, 35.75, 39.75],
                /* 6 a 7 kg */[3.38, 4.38, 5.08, 27.05, 31.05, 36.05, 40.05, 44.05],
                /* 7 a 8 kg */[3.43, 4.48, 5.18, 28.85, 33.65, 38.45, 43.25, 48.05],
                /* 8 a 9 kg */[3.48, 4.58, 5.28, 29.65, 34.55, 39.55, 44.45, 49.35],
                /* 9 a 11 kg */[3.53, 4.78, 5.48, 41.25, 48.05, 54.95, 61.75, 68.65],
                /* 11 a 13 kg */[3.58, 4.98, 5.68, 42.15, 49.25, 56.25, 63.25, 70.25],
                /* 13 a 15 kg */[3.63, 5.08, 5.78, 45.05, 52.45, 59.95, 67.45, 74.95],
                /* 15 a 17 kg */[3.68, 5.18, 5.88, 48.55, 56.05, 63.55, 70.75, 78.65],
                /* 17 a 20 kg */[3.73, 5.28, 5.98, 54.75, 63.85, 72.95, 82.05, 91.15],
                /* 20 a 25 kg */[3.83, 5.48, 6.08, 64.05, 75.05, 84.75, 95.35, 105.95],
                /* 25 a 30 kg */[3.88, 5.58, 6.18, 65.95, 75.45, 85.55, 96.25, 106.95],
                /* 30 a 40 kg */[3.93, 5.68, 6.28, 67.75, 78.95, 88.95, 99.15, 107.05],
                /* 40 a 50 kg */[3.98, 5.78, 6.38, 70.25, 81.05, 92.05, 102.55, 110.75],
                /* 50 a 60 kg */[4.03, 5.88, 6.48, 74.95, 86.45, 98.15, 109.35, 118.15],
                /* 60 a 70 kg */[4.08, 5.98, 6.58, 80.25, 92.95, 105.05, 117.15, 126.55],
                /* 70 a 80 kg */[4.13, 6.08, 6.68, 83.95, 97.05, 109.85, 122.45, 132.55],
                /* 80 a 90 kg */[4.18, 6.18, 6.78, 93.25, 107.45, 122.05, 136.05, 146.95],
                /* 90 a 100 kg */[4.23, 6.28, 6.88, 106.55, 123.95, 139.55, 155.55, 167.95],
                /* 100 a 125 kg */[4.28, 6.37, 6.98, 119.25, 138.05, 156.05, 173.95, 187.95],
                /* 125 a 150 kg */[4.33, 6.37, 7.07, 126.55, 146.15, 165.65, 184.65, 199.45],
                /* Mais de 150 kg */[4.38, 6.37, 7.17, 166.15, 192.45, 217.55, 242.55, 261.95]
            ];

            const superMatrix = [
                /* Até 0,3 kg */[1.25, 1.50, 2.00, 3.00, 4.00, 6.00, 20.95],
                /* 0,3 a 0,5 kg */[1.25, 1.50, 2.00, 3.00, 4.00, 6.00, 22.55],
                /* 0,5 a 1 kg */[1.25, 1.50, 2.00, 3.00, 4.00, 6.00, 23.65],
                /* 1 a 1,5 kg */[1.75, 2.00, 2.50, 3.50, 4.50, 6.50, 24.65],
                /* 1,5 a 2 kg */[1.75, 2.00, 2.50, 3.50, 4.50, 6.50, 24.65],
                /* 2 a 3 kg */[2.00, 2.50, 3.00, 4.00, 5.50, 7.00, 26.25],
                /* 3 a 4 kg */[2.00, 2.50, 3.00, 4.00, 5.50, 7.00, 28.35],
                /* 4 a 5 kg */[2.50, 3.50, 4.00, 5.00, 6.00, 7.50, 30.75],
                /* 5 a 6 kg */[2.50, 3.50, 4.00, 5.00, 6.00, 7.50, 39.75],
                /* 6 a 7 kg */[4.00, 5.00, 5.50, 6.50, 7.00, 7.50, 44.05],
                /* 7 a 8 kg */[4.00, 5.00, 5.50, 6.50, 7.00, 7.50, 48.05],
                /* 8 a 9 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 49.35],
                /* 9 a 11 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 68.65],
                /* 11 a 13 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 70.25],
                /* 13 a 15 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 74.95],
                /* 15 a 17 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 78.65],
                /* 17 a 20 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 91.15],
                /* 20 a 25 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 105.95],
                /* 25 a 30 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 106.95],
                /* 30 a 40 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 107.05],
                /* 40 a 50 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 110.75],
                /* 50 a 60 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 118.15],
                /* 60 a 70 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 126.55],
                /* 70 a 80 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 132.25],
                /* 80 a 90 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 146.95],
                /* 90 a 100 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 167.95],
                /* 100 a 125 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 187.95],
                /* 125 a 150 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 199.45],
                /* Mais de 150 kg */[5.00, 6.00, 6.50, 7.00, 7.50, 8.00, 261.95]
            ];

            const matrix = specialCategory === 'others_special' ? specialMatrix : (specialCategory === 'used' ? usedMatrix : (specialCategory === 'pets' ? petsMatrix : (specialCategory === 'books' ? booksMatrix : (specialCategory === 'super' ? superMatrix : standardMatrix))));

            // Determine price column index
            if (specialCategory === 'super') {
                if (price < 19) colIdx = 0;
                else if (price < 29) colIdx = 1;
                else if (price < 49) colIdx = 2;
                else if (price < 79) colIdx = 3;
                else if (price < 99) colIdx = 4;
                else if (price < 199) colIdx = 5;
                else colIdx = 6;
            } else if (specialCategory === 'used') {
                if (price < 19) colIdx = 0;
                else if (price < 49) colIdx = 1;
                else if (price < 79) colIdx = 2;
                else colIdx = 3;
            } else if (specialCategory === 'pets') {
                if (price < 19) colIdx = 0;
                else if (price < 49) colIdx = 1;
                else if (price < 79) colIdx = 2;
                else if (price < 200) colIdx = 3;
                else colIdx = 4;
            } else {
                // 0: 0-18.99, 1: 19-48.99, 2: 49-78.99, 3: 79-99.99, 4: 100-119.99, 5: 120-149.99, 6: 150-199.99, 7: 200+
                if (price < 19) colIdx = 0;
                else if (price < 49) colIdx = 1;
                else if (price < 79) colIdx = 2;
                else if (price < 100) colIdx = 3;
                else if (price < 120) colIdx = 4;
                else if (price < 150) colIdx = 5;
                else if (price < 200) colIdx = 6;
                else colIdx = 7;
            }

            // Determine weight row index
            let rowIdx = 0;
            if (weight <= 0.3) rowIdx = 0;
            else if (weight <= 0.5) rowIdx = 1;
            else if (weight <= 1.0) rowIdx = 2;
            else if (weight <= 1.5) rowIdx = 3;
            else if (weight <= 2.0) rowIdx = 4;
            else if (weight <= 3.0) rowIdx = 5;
            else if (weight <= 4.0) rowIdx = 6;
            else if (weight <= 5.0) rowIdx = 7;
            else if (weight <= 6.0) rowIdx = 8;
            else if (weight <= 7.0) rowIdx = 9;
            else if (weight <= 8.0) rowIdx = 10;
            else if (weight <= 9.0) rowIdx = 11;
            else if (weight <= 11.0) rowIdx = 12;
            else if (weight <= 13.0) rowIdx = 13;
            else if (weight <= 15.0) rowIdx = 14;
            else if (weight <= 17.0) rowIdx = 15;
            else if (weight <= 20.0) rowIdx = 16;
            else if (weight <= 25.0) rowIdx = 17;
            else if (weight <= 30.0) rowIdx = 18;
            else if (weight <= 40.0) rowIdx = 19;
            else if (weight <= 50.0) rowIdx = 20;
            else if (weight <= 60.0) rowIdx = 21;
            else if (weight <= 70.0) rowIdx = 22;
            else if (weight <= 80.0) rowIdx = 23;
            else if (weight <= 90.0) rowIdx = 24;
            else if (weight <= 100.0) rowIdx = 25;
            else if (weight <= 125.0) rowIdx = 26;
            else if (weight <= 150.0) rowIdx = 27;
            else rowIdx = 28;

            const cost = matrix[rowIdx][colIdx];
            let shippingCost = cost;

            // Apply price caps
            if (specialCategory === 'super' && price < 29) {
                shippingCost = Math.min(shippingCost, price * 0.25);
            } else {
                shippingCost = Math.min(shippingCost, maxCostForLowPrice);
            }

            return shippingCost;
        }
    }
};

