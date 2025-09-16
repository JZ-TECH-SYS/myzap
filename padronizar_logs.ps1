# Script para padronizar todos os logs para customLogger

Write-Host "Iniciando padronizacao dos logs..." -ForegroundColor Cyan

# Lista de arquivos para atualizar
$arquivos = @(
    "util\cache.js",
    "startup.js",
    "middlewares\checkNumber.js",
    "functions\WPPConnect\helper\commands.js",
    "functions\WPPConnect\helper\auth.js",
    "functions\WPPConnect\helper\status\profile.js",
    "functions\WPPConnect\helper\status\stories.js",
    "functions\WPPConnect\helper\mensagens\file.js",
    "functions\WPPConnect\helper\mensagens\audio.js"
)

foreach ($arquivo in $arquivos) {
    if (Test-Path $arquivo) {
        Write-Host "Atualizando: $arquivo" -ForegroundColor Yellow
        
        # Substituir logger. por customLogger.
        (Get-Content $arquivo) -replace 'logger\.', 'customLogger.' | Set-Content $arquivo
        
        # Substituir console.log por customLogger.info
        (Get-Content $arquivo) -replace 'console\.log', 'customLogger.info' | Set-Content $arquivo
        
        # Substituir console.error por customLogger.error
        (Get-Content $arquivo) -replace 'console\.error', 'customLogger.error' | Set-Content $arquivo
        
        Write-Host "Concluido: $arquivo" -ForegroundColor Green
    } else {
        Write-Host "Arquivo nao encontrado: $arquivo" -ForegroundColor Red
    }
}

Write-Host "Padronizacao concluida!" -ForegroundColor Green
