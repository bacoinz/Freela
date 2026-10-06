# Gera a APK assinada da app Ganhos em release\Ganhos-vX.Y.Z.apk
# Uso:  npm run apk
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# --- JDK 21 (vem com o Android Studio). Só para este build: o JAVA_HOME global não muda. ---
$jdkCandidates = @(
  $env:GANHOS_JAVA_HOME,
  'C:\Program Files\Android\Android Studio\jbr',
  "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
  "$env:LOCALAPPDATA\JetBrains\Toolbox\apps\AndroidStudio\ch-0\current\jbr"
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) }
if (-not $jdkCandidates) {
  throw 'Não encontrei o JDK do Android Studio (pasta "jbr"). Instala o Android Studio primeiro (ver docs\COMO-INSTALAR.md).'
}
$env:JAVA_HOME = @($jdkCandidates)[0]
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# --- Android SDK ---
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'platforms'))) {
  throw "Android SDK não encontrado em $env:ANDROID_HOME. Abre o Android Studio uma vez e conclui o assistente de instalação."
}

# --- Chave de assinatura ---
if (-not (Test-Path 'keystore\keystore.properties')) {
  throw 'Falta a chave de assinatura (keystore\keystore.properties). Sem ela a APK não pode ser instalada/atualizada.'
}

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
Write-Host "==> Ganhos v$version" -ForegroundColor Cyan
Write-Host "    JDK: $env:JAVA_HOME"
Write-Host "    SDK: $env:ANDROID_HOME"

Write-Host '==> 1/3 Build da web-app' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'O build da web-app falhou.' }

Write-Host '==> 2/3 Copiar para o projeto Android (cap sync)' -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'cap sync falhou.' }

Write-Host '==> 3/3 Gerar a APK (Gradle)' -ForegroundColor Cyan
Push-Location android
try {
  .\gradlew.bat assembleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'O Gradle falhou a gerar a APK.' }
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force release | Out-Null
$out = "release\Ganhos-v$version.apk"
Copy-Item 'android\app\build\outputs\apk\release\app-release.apk' $out -Force
Write-Host ''
Write-Host "APK pronta: $out" -ForegroundColor Green
Write-Host 'Para instalar com o telemóvel ligado por USB:  npm run apk:install'
