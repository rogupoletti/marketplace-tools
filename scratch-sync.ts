import { runGlobalFullSync } from './src/server/integrations/mercadolivre/sync-full';

async function main() {
  console.log('--- Iniciando Sincronização Manual do Mercado Livre Full ---');
  const start = Date.now();
  
  try {
    const result = await runGlobalFullSync();
    const end = Date.now();
    const duration = ((end - start) / 1000).toFixed(2);
    
    console.log('\n--- Resultado ---');
    console.log(JSON.stringify(result, null, 2));
    console.log(`\nTempo total de execução: ${duration} segundos`);
  } catch (error) {
    console.error('Erro na execução:', error);
  } finally {
    process.exit(0);
  }
}

main();
