/**
 * 🧹 SCRIPT: Limpar cache de números brasileiros sem código +55
 * 
 * PROBLEMA:
 * - Cache antigo salvo como: 44999710077@c.us (ERRADO)
 * - Cache correto deve ser: 5544999710077@c.us (CERTO)
 * 
 * SOLUÇÃO:
 * - Deleta todos os registros do cache que:
 *   1. Tenham profile terminando em @c.us (contatos, não grupos)
 *   2. Não tenham código de país (55)
 *   3. Tenham entre 10-11 dígitos (formato brasileiro sem +55)
 * 
 * USO:
 * node scripts/cleanBrokenCache.js
 */

const config = require("../config.js");
const Cache = require("../Models/cache.js");
const CacheModel = Cache(config.sequelize);

async function cleanBrokenCache() {
  console.log("\n🧹 INICIANDO LIMPEZA DE CACHE QUEBRADO...\n");

  try {
    // Buscar todos os registros de cache
    const allCache = await CacheModel.findAll();
    console.log(`📊 Total de registros no cache: ${allCache.length}`);

    let deletedCount = 0;
    let keptCount = 0;

    for (const cache of allCache) {
      const { number, profile } = cache;

      // Verificar se é contato (não grupo)
      if (!profile || !profile.endsWith("@c.us")) {
        keptCount++;
        continue;
      }

      // Extrair o número do profile (sem @c.us)
      const phoneNumber = profile.replace("@c.us", "");

      // Verificar se é número brasileiro SEM código +55
      // Formato errado: 10-11 dígitos (ex: 44999710077)
      // Formato correto: 12-13 dígitos (ex: 5544999710077)
      if (phoneNumber.length >= 10 && phoneNumber.length <= 11) {
        console.log(`❌ DELETANDO: ${number} → ${profile} (sem código +55)`);
        await cache.destroy();
        deletedCount++;
      } else if (phoneNumber.length >= 12 && !phoneNumber.startsWith("55")) {
        console.log(`❌ DELETANDO: ${number} → ${profile} (código errado)`);
        await cache.destroy();
        deletedCount++;
      } else {
        console.log(`✅ MANTENDO: ${number} → ${profile} (formato OK)`);
        keptCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`✅ LIMPEZA CONCLUÍDA!`);
    console.log(`📊 Registros deletados: ${deletedCount}`);
    console.log(`📊 Registros mantidos: ${keptCount}`);
    console.log("=".repeat(60) + "\n");

    if (deletedCount > 0) {
      console.log("⚠️  ATENÇÃO:");
      console.log("   Os números deletados serão reprocessados na próxima vez");
      console.log("   que alguém enviar mensagem, agora com o formato correto!\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO ao limpar cache:", error);
    process.exit(1);
  }
}

// Executar
cleanBrokenCache();
