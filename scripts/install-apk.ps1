# Instala (ou atualiza, mantendo os dados) a APK no telemóvel ligado por USB.
# Uso:  npm run apk:install
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "Não encontrei o adb em $adb (vem com o Android SDK)." }

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$apk = "release\Ganhos-v$version.apk"
if (-not (Test-Path $apk)) { throw "Não encontrei $apk. Gera primeiro com: npm run apk" }

$devices = & $adb devices | Select-String -Pattern '\tdevice$'
if (-not $devices) {
  throw 'Nenhum telemóvel encontrado. Liga-o por USB, ativa a "Depuração USB" (Opções de programador) e aceita o pedido no telemóvel.'
}

Write-Host "==> A instalar $apk (os dados da app mantêm-se)" -ForegroundColor Cyan
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'A instalação falhou.' }
Write-Host 'Instalado.' -ForegroundColor Green
