/**
 * Retorna a tarifa fixa baseada no preço do produto.
 * Para Livros, a regra é diferente.
 */
export const getMeliFlatFee = (price: number, specialCategory?: string) => {
    if (price >= 79) return 0;

    if (specialCategory === 'books') {
        if (price < 6) return Number((price / 2).toFixed(2));
        if (price < 29) return 3.00;
        if (price < 50) return 3.50;
        if (price < 79) return 4.00;
    }

    if (price < 12.50) return Number((price / 2).toFixed(2));
    if (price < 29) return 6.25;
    if (price < 50) return 6.50;
    if (price < 79) return 6.75;
    return 0;
};
