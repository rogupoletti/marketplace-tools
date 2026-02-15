/**
 * Regras de comissão da Shopee para 2026.
 * @see https://seller.shopee.com.br/edu/article/26839/Comissao-para-vendedores-CNPJ-e-CPF-em-2026
 */
export const SHOPEE_RATES = {
    getCommission: (price: number) => {
        let pct = 0.14;
        let fixed = 26;

        if (price < 80) {
            pct = 0.20;
            if (price < 8) {
                fixed = price / 2;
            } else {
                fixed = 4;
            }
        } else if (price < 100) {
            fixed = 16;
        } else if (price < 200) {
            fixed = 20;
        } else {
            fixed = 26;
        }

        return { pct, fixed, total: (price * pct) + fixed };
    }
};
