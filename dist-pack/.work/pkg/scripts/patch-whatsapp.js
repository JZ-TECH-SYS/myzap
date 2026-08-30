#!/usr/bin/env node

/**
 * Patch para whatsapp-web.js
 * Corrige erro: Cannot read properties of undefined (reading 'markedUnread')
 * 
 * Este script é executado automaticamente após npm install
 * Issue: https://github.com/pedroslopez/whatsapp-web.js/issues/5718
 * Fix: https://github.com/pedroslopez/whatsapp-web.js/pull/5719
 */

const fs = require('fs');
const path = require('path');

const utilsPath = path.join(
  __dirname,
  '..',
  'node_modules/whatsapp-web.js/src/util/Injected/Utils.js'
);

if (!fs.existsSync(utilsPath)) {
  console.log('[patch] whatsapp-web.js não instalado, pulando patch...');
  process.exit(0);
}

try {
  let content = fs.readFileSync(utilsPath, 'utf8');

  if (content.includes('SendSeen.sendSeen')) {
    content = content.replace(
      'await window.Store.SendSeen.sendSeen(chat);',
      'await window.Store.SendSeen.markSeen(chat);'
    );
    fs.writeFileSync(utilsPath, content, 'utf8');
    console.log('[patch] whatsapp-web.js corrigido: sendSeen -> markSeen');
  } else if (content.includes('SendSeen.markSeen')) {
    console.log('[patch] ℹ️ whatsapp-web.js já está corrigido');
  } else {
    console.log('[patch] ⚠️ sendSeen não encontrado em Utils.js, estrutura pode ter mudado');
  }
} catch (error) {
  console.error('[patch] ❌ Erro ao aplicar patch:', error.message);
  process.exit(1);
}
