/**
 * 🧹 SCRIPT: Limpar cache de números com formato incorreto
 * 
 * PROBLEMA ATUAL (17/10/2025):
 * - Número enviado: 5544997633866 (13 dígitos - COM 9)
 * - Cache salvava: 5544997633866@c.us (ERRADO - número fantasma)
 * - Cache correto: 554497633866@c.us (12 dígitos - SEM 9)
 * 
 * PROBLEMA ANTIGO:
 * - Cache sem código +55: 44999710077@c.us
 * - Cache correto: 5544999710077@c.us
 * 
 * SOLUÇÃO:
 * - Deleta TODOS os registros do cache de números brasileiros
 * - Força reprocessamento com a nova lógica de verificação
 * - Salva automaticamente o formato correto
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
    let groupsCount = 0;

    for (const cache of allCache) {
      const { number, profile } = cache;

      // Ignorar grupos (@g.us)
      if (!profile || profile.endsWith("@g.us")) {
        groupsCount++;
        continue;
      }

      // Verificar se é contato (@c.us)
      if (!profile.endsWith("@c.us")) {
        keptCount++;
        continue;
      }

      // Extrair o número do profile (sem @c.us)
      const phoneNumber = profile.replace("@c.us", "");

      // CRITÉRIO 1: Número brasileiro SEM código +55
      // Formato errado: 10-11 dígitos (ex: 44999710077 ou 4499971007)
      if (phoneNumber.length >= 10 && phoneNumber.length <= 11) {
        console.log(`❌ DELETANDO: ${number} → ${profile} (sem código +55)`);
        await cache.destroy();
        deletedCount++;
        continue;
      }

      // CRITÉRIO 2: Número com código errado (não começa com 55)
      if (phoneNumber.length >= 12 && !phoneNumber.startsWith("55")) {
        console.log(`❌ DELETANDO: ${number} → ${profile} (código errado)`);
        await cache.destroy();
        deletedCount++;
        continue;
      }

      // CRITÉRIO 3: NOVO - Deletar TODOS os números brasileiros para revalidar
      // Isso garante que números salvos com formato errado sejam reprocessados
      if (phoneNumber.startsWith("55") && (phoneNumber.length === 12 || phoneNumber.length === 13)) {
        console.log(`⚠️  DELETANDO (revalidação): ${number} → ${profile}`);
        await cache.destroy();
        deletedCount++;
        continue;
      }

      // Manter outros formatos
      console.log(`✅ MANTENDO: ${number} → ${profile}`);
      keptCount++;
    }

    console.log("\n" + "=".repeat(60));
    console.log(`✅ LIMPEZA CONCLUÍDA!`);
    console.log(`📊 Registros deletados: ${deletedCount}`);
    console.log(`📊 Grupos ignorados: ${groupsCount}`);
    console.log(`📊 Outros mantidos: ${keptCount}`);
    console.log("=".repeat(60) + "\n");

    if (deletedCount > 0) {
      console.log("⚠️  ATENÇÃO:");
      console.log("   Os números deletados serão reprocessados na próxima vez");
      console.log("   que alguém enviar mensagem, agora com o formato correto!");
      console.log("   A nova lógica tentará automaticamente COM e SEM o 9º dígito.\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERRO ao limpar cache:", error);
    process.exit(1);
  }
}

// Executar
cleanBrokenCache();
