param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\dist")
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

$runtimeFiles = @(
    "manifest.json",
    "content.js",
    "page-bridge.js",
    "styles.css",
    "popup.html",
    "popup.css",
    "popup.js",
    "assets\icons\icon16.png",
    "assets\icons\icon32.png",
    "assets\icons\icon48.png",
    "assets\icons\icon128.png"
)

foreach ($relativePath in $runtimeFiles) {
    $sourcePath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Required package file is missing: $relativePath"
    }
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$staging = Join-Path $OutputDirectory (".staging-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging | Out-Null

try {
    foreach ($relativePath in $runtimeFiles) {
        $sourcePath = Join-Path $projectRoot $relativePath
        $destinationPath = Join-Path $staging $relativePath
        $destinationParent = Split-Path -Parent $destinationPath
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }

    $chromiumPackage = Join-Path $OutputDirectory "no-live-for-youtube-chromium-v$version.zip"
    $firefoxPackage = Join-Path $OutputDirectory "no-live-for-youtube-firefox-v$version.xpi"
    if (Test-Path -LiteralPath $chromiumPackage) { Remove-Item -LiteralPath $chromiumPackage -Force }
    if (Test-Path -LiteralPath $firefoxPackage) { Remove-Item -LiteralPath $firefoxPackage -Force }

    Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $chromiumPackage -CompressionLevel Optimal
    Copy-Item -LiteralPath $chromiumPackage -Destination $firefoxPackage

    $checksumFile = Join-Path $OutputDirectory "SHA256SUMS.txt"
    $checksums = @($chromiumPackage, $firefoxPackage) | ForEach-Object {
        $item = Get-Item -LiteralPath $_
        $hash = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $($item.Name)"
    }
    Set-Content -LiteralPath $checksumFile -Value $checksums -Encoding Ascii

    Write-Output "Built $chromiumPackage"
    Write-Output "Built $firefoxPackage"
    Write-Output "Wrote $checksumFile"
}
finally {
    $resolvedStaging = (Resolve-Path -LiteralPath $staging -ErrorAction SilentlyContinue).Path
    $resolvedOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
    if ($resolvedStaging -and $resolvedStaging.StartsWith($resolvedOutput, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
