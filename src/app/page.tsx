import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl tracking-tight">
          Sua Central de <span className="text-primary">E-commerce</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Ferramentas profissionais para precificação e gestão de vendas nos maiores marketplaces.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Link
          href="/shopee"
          className="group block p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Calculadora Shopee</h2>
          <p className="text-gray-500">
            Precifique seus produtos considerando as novas taxas, fretes e metas de margem da Shopee.
          </p>
          <div className="mt-6 flex items-center text-primary font-bold">
            Acessar Ferramenta
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </div>
        </Link>

        <Link
          href="/meli"
          className="group block p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-meli-secondary hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-meli-secondary/10 rounded-xl flex items-center justify-center mb-6 text-meli-secondary group-hover:bg-meli-secondary group-hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">MELI Calculadora</h2>
          <p className="text-gray-500">
            Cálculo detalhado de comissões por categoria, Clássico/Premium e fretes tabelados do Meli.
          </p>
          <div className="mt-6 flex items-center text-meli-secondary font-bold">
            Acessar Ferramenta
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </div>
        </Link>

        <Link
          href="/amazon"
          className="group block p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-secondary hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-6 text-secondary group-hover:bg-secondary group-hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Calculadora Amazon</h2>
          <p className="text-gray-500">
            Simule seus lucros na Amazon considerando taxas DBA, FBA, FBA Onsite e impostos.
          </p>
          <div className="mt-6 flex items-center text-secondary font-bold">
            Acessar Ferramenta
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
            </svg>
          </div>
        </Link>
      </div>

      <div className="mt-16 text-center">
        <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-medium bg-secondary/20 text-secondary">
          Em breve novos marketplaces e novas funcionalidades
        </span>
      </div>
    </div>
  );
}
