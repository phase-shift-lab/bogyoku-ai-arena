[CmdletBinding()]
param(
    [string]$SourceDirectory = "",
    [ValidateRange(1, 64)]
    [int]$Jobs = [Math]::Min([Environment]::ProcessorCount, 8)
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$PinnedCommit = "1308ab3803e0011979473296741e56a6981c46ba"
$PinnedEmsdk = "4.0.21"
$Upstream = "https://github.com/yaneurao/YaneuraOu.git"
$PatchFile = Join-Path $PSScriptRoot "yaneuraou-wasm.patch"
$PthreadsPatchFile = Join-Path $PSScriptRoot "yaneuraou-wasm-pthreads.patch"

if (-not $SourceDirectory) {
    $SourceDirectory = Join-Path $RepositoryRoot ".vendor\YaneuraOu-build"
}
$SourceDirectory = [IO.Path]::GetFullPath($SourceDirectory)

foreach ($command in @("git", "make", "em++")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command is unavailable: $command"
    }
}

$emVersion = (& em++ --version | Select-Object -First 1)
if ($emVersion -notmatch [regex]::Escape($PinnedEmsdk)) {
    throw "Emscripten $PinnedEmsdk is required. Detected: $emVersion"
}

if (-not (Test-Path -LiteralPath (Join-Path $SourceDirectory ".git"))) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SourceDirectory) | Out-Null
    & git clone --filter=blob:none $Upstream $SourceDirectory
    if ($LASTEXITCODE -ne 0) { throw "YaneuraOu clone failed." }
}

$dirty = & git -C $SourceDirectory status --porcelain --untracked-files=no
if ($dirty) {
    throw "The source checkout has tracked changes. Use a clean directory: $SourceDirectory"
}

& git -C $SourceDirectory cat-file -e "$PinnedCommit^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
    & git -C $SourceDirectory fetch origin $PinnedCommit --depth 1
    if ($LASTEXITCODE -ne 0) { throw "Pinned YaneuraOu commit fetch failed." }
}
& git -C $SourceDirectory checkout --detach $PinnedCommit
if ($LASTEXITCODE -ne 0) { throw "Pinned YaneuraOu commit checkout failed." }
& git -C $SourceDirectory apply --check $PatchFile
if ($LASTEXITCODE -ne 0) { throw "WASM bridge patch check failed." }
& git -C $SourceDirectory apply $PatchFile
if ($LASTEXITCODE -ne 0) { throw "WASM bridge patch failed." }
& git -C $SourceDirectory apply --check $PthreadsPatchFile
if ($LASTEXITCODE -ne 0) { throw "WASM pthread patch check failed." }
& git -C $SourceDirectory apply $PthreadsPatchFile
if ($LASTEXITCODE -ne 0) { throw "WASM pthread patch failed." }

$sourceRoot = Join-Path $SourceDirectory "source"
$publicRoot = Join-Path $RepositoryRoot "public\engine"
$runtimeRoot = Join-Path $RepositoryRoot "src\engine\runtime"
New-Item -ItemType Directory -Force -Path $publicRoot | Out-Null

function Invoke-EngineBuild {
    param(
        [Parameter(Mandatory)] [ValidateSet("single", "threaded")] [string]$Variant,
        [Parameter(Mandatory)] [ValidateSet(0, 1)] [int]$Threads
    )

    Push-Location $sourceRoot
    try {
        & make clean
        if ($LASTEXITCODE -ne 0) { throw "make clean failed for $Variant." }
        & make "-j$Jobs" YANEURAOU_EDITION=YANEURAOU_ENGINE_MATERIAL MATERIAL_LEVEL=1 TARGET_CPU=WASM COMPILER=em++ "WASM_THREADS=$Threads" normal
        if ($LASTEXITCODE -ne 0) { throw "YaneuraOu $Variant build failed." }
    }
    finally {
        Pop-Location
    }

    $runtimeVariant = Join-Path $runtimeRoot $Variant
    $publicVariant = Join-Path $publicRoot $Variant
    New-Item -ItemType Directory -Force -Path $runtimeVariant | Out-Null
    New-Item -ItemType Directory -Force -Path $publicVariant | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourceRoot "yaneuraou.js") -Destination (Join-Path $publicRoot "yaneuraou.$Variant.js") -Force
    Copy-Item -LiteralPath (Join-Path $sourceRoot "yaneuraou.wasm") -Destination (Join-Path $publicRoot "yaneuraou.$Variant.wasm") -Force
    Copy-Item -LiteralPath (Join-Path $sourceRoot "yaneuraou.js") -Destination (Join-Path $publicVariant "yaneuraou.js") -Force
    Copy-Item -LiteralPath (Join-Path $sourceRoot "yaneuraou.wasm") -Destination (Join-Path $publicVariant "yaneuraou.wasm") -Force
    Copy-Item -LiteralPath (Join-Path $sourceRoot "yaneuraou.js") -Destination (Join-Path $runtimeVariant "yaneuraou.js") -Force
    Copy-Item -LiteralPath (Join-Path $sourceRoot "yaneuraou.wasm") -Destination (Join-Path $runtimeVariant "yaneuraou.wasm") -Force
}

Invoke-EngineBuild -Variant single -Threads 0
Invoke-EngineBuild -Variant threaded -Threads 1

Get-ChildItem -LiteralPath $publicRoot -File -Recurse |
    Where-Object Name -Match '^yaneuraou(\.(single|threaded))?\.(js|wasm)$' |
    Sort-Object Name |
    ForEach-Object {
        [pscustomobject]@{
            File = [IO.Path]::GetRelativePath($publicRoot, $_.FullName)
            Bytes = $_.Length
            SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    } |
    Format-Table -AutoSize

Write-Host "Built from YaneuraOu $PinnedCommit with emsdk $PinnedEmsdk."
