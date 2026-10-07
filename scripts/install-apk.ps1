# Instala (ou atualiza, mantendo os dados) a APK no telemóvel ligado por USB.
# Uso:  npm run apk:install
# (Guardado em UTF-8 com BOM para o Windows PowerShell mostrar bem os acentos.)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Fail([string]$msg) {
  Write-Host ''
  Write-Host "ERRO: $msg" -ForegroundColor Red
  exit 1
}

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { Fail "Não encontrei o adb em $adb (vem com o Android SDK)." }

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$apk = "release\Freela-v$version.apk"
if (-not (Test-Path $apk)) { Fail "Não encontrei $apk. Gera primeiro com: npm run apk" }

$ErrorActionPreference = 'Continue' # o adb escreve mensagens no stderr; conta o código de saída
$devices = & $adb devices | Select-String -Pattern '\tdevice$'
if (-not $devices) {
  Fail 'Nenhum telemóvel encontrado. Liga-o por USB, ativa a "Depuração USB" (Opções de programador) e aceita o pedido no telemóvel.'
}

Write-Host "==> A instalar $apk (os dados da app mantêm-se)" -ForegroundColor Cyan
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { Fail 'A instalação falhou.' }
Write-Host 'Instalado.' -ForegroundColor Green
