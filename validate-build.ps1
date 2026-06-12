# Script de validation de build pour Liquid Dynamic Island V2

$ErrorActionPreference = "Stop"

Write-Host "=== Commencer la validation du build ===" -ForegroundColor Cyan

# 1. Lire la version depuis package.json
if (-not (Test-Path "package.json")) {
    Write-Error "Fichier package.json introuvable."
    exit 1
}

$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
$version = $packageJson.version

Write-Host "Version détectée : $version" -ForegroundColor Green

# 2. Vérifier l'existence des fichiers dans dist/
$setupPath = "dist/Liquid.Dynamic.Island-$version-Setup-x64.exe"
$ymlPath = "dist/latest.yml"

Write-Host "Vérification de l'existence de l'installateur..." -ForegroundColor Yellow
if (-not (Test-Path $setupPath)) {
    Write-Error "L'installateur $setupPath n'existe pas. Veuillez lancer 'npm run build'."
    exit 1
}
Write-Host "[OK] Installateur trouvé : $setupPath" -ForegroundColor Green

Write-Host "Vérification de l'existence du fichier latest.yml..." -ForegroundColor Yellow
if (-not (Test-Path $ymlPath)) {
    Write-Error "Le fichier $ymlPath n'existe pas."
    exit 1
}
Write-Host "[OK] latest.yml trouvé." -ForegroundColor Green

# 3. Vérifier que la version dans latest.yml correspond à package.json
Write-Host "Vérification de la version dans latest.yml..." -ForegroundColor Yellow
$ymlContent = Get-Content -Path $ymlPath
$versionLine = $ymlContent | Where-Object { $_ -match "^version:\s*$version" }

if (-not $versionLine) {
    Write-Error "La version dans latest.yml ne correspond pas à la version de package.json ($version)."
    exit 1
}
Write-Host "[OK] Version dans latest.yml correspondante." -ForegroundColor Green

# 4. Vérifier la taille du fichier d'installation (doit être < 200 Mo)
Write-Host "Vérification de la taille de l'installateur..." -ForegroundColor Yellow
$fileInfo = Get-Item $setupPath
$fileSizeMB = $fileInfo.Length / 1MB

Write-Host "Taille de l'installateur : ($([math]::round($fileSizeMB, 2)) Mo)" -ForegroundColor Cyan

if ($fileSizeMB -gt 200) {
    Write-Error "L'installateur dépasse la limite de 200 Mo (Taille actuelle : $([math]::round($fileSizeMB, 2)) Mo)."
    exit 1
}
Write-Host "[OK] Taille de l'installateur inférieure à 200 Mo." -ForegroundColor Green

Write-Host "=== Validation réussie avec succès ! ===" -ForegroundColor Green
exit 0
