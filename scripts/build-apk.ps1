# Gera a APK assinada da app Freela em release\Freela-vX.Y.Z.apk
# Uso:  npm run apk
# (Guardado em UTF-8 com BOM para o Windows PowerShell mostrar bem os acentos.)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Fail([string]$msg) {
  Write-Host ''
  Write-Host "ERRO: $msg" -ForegroundColor Red
  exit 1
}

# --- Java 21 a 24: o Capacitor 8 exige o 21 e o Gradle 8.14 não corre no 25. ---
# Só para este build: o JAVA_HOME global não muda.
function Get-JavaMajor([string]$dir) {
  $release = Join-Path $dir 'release'
  if (-not (Test-Path $release)) { return 0 }
  $m = Select-String -Path $release -Pattern '^JAVA_VERSION="(\d+)' | Select-Object -First 1
  if ($m) { return [int]$m.Matches[0].Groups[1].Value }
  return 0
}
$jdkCandidates = @($env:FREELA_JAVA_HOME, "$env:LOCALAPPDATA\Android\jdk-21")
$jdkCandidates += Get-ChildItem 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Microsoft', 'C:\Program Files\Java' `
  -Directory -Filter 'jdk-2*' -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object { $_.FullName }
$jdkCandidates += 'C:\Program Files\Android\Android Studio\jbr', "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
$jdk = $jdkCandidates |
  Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) -and ((Get-JavaMajor $_) -in 21..24) } |
  Select-Object -First 1
if (-not $jdk) {
  Fail 'Não encontrei o Java 21 (serve do 21 ao 24; o 25 é recente demais para o Gradle). Ver docs\COMO-INSTALAR.md, ou define FREELA_JAVA_HOME com a pasta do JDK.'
}
$env:JAVA_HOME = $jdk
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# --- Android SDK ---
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'platforms'))) {
  Fail "Android SDK não encontrado em $env:ANDROID_HOME. Abre o Android Studio uma vez e conclui o assistente de instalação."
}

# --- Chave de assinatura ---
if (-not (Test-Path 'keystore\keystore.properties')) {
  Fail 'Falta a chave de assinatura (keystore\keystore.properties). Sem ela a APK não pode ser instalada/atualizada.'
}

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
Write-Host "==> Freela v$version" -ForegroundColor Cyan
Write-Host "    JDK: $env:JAVA_HOME"
Write-Host "    SDK: $env:ANDROID_HOME"

# Daqui em diante: npm/npx/gradlew escrevem avisos no stderr, o que não é erro.
# Cada passo é verificado pelo código de saída ($LASTEXITCODE).
$ErrorActionPreference = 'Continue'

Write-Host '==> 1/3 Build da web-app' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Fail 'O build da web-app falhou.' }

Write-Host '==> 2/3 Copiar para o projeto Android (cap sync)' -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { Fail 'cap sync falhou.' }

Write-Host '==> 3/3 Gerar a APK (Gradle)' -ForegroundColor Cyan
Push-Location android
.\gradlew.bat assembleRelease --no-daemon
$gradleExit = $LASTEXITCODE
Pop-Location
if ($gradleExit -ne 0) { Fail 'O Gradle falhou a gerar a APK.' }

New-Item -ItemType Directory -Force release -ErrorAction Stop | Out-Null
$out = "release\Freela-v$version.apk"
Copy-Item 'android\app\build\outputs\apk\release\app-release.apk' $out -Force -ErrorAction Stop
Write-Host ''
Write-Host "APK pronta: $out" -ForegroundColor Green
Write-Host 'Para instalar com o telemóvel ligado por USB:  npm run apk:install'
