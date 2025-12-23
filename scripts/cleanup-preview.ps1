# Preview-only cleanup candidates (no deletions)
# Lists regeneratable build/cache artifacts and their sizes

Param(
    [switch]$All
)

$Root = Split-Path -Parent $PSScriptRoot

$Candidates = @(
    ".next",
    ".turbo",
    ".vercel",
    "dist",
    "functions/.next",
    "functions/lib",
    "playwright-report",
    "test-results",
    "extension/dist",
    "extension/dist-firefox"
)

$LogFiles = @(
    "build_output.txt",
    "build_log_full.txt",
    "build_no_global_error.log",
    "final_build.log",
    "full_build.log"
)

$Archives = @(
    "extension/celora-extension-chrome-v1.0.0.zip",
    "extension/celora-extension-firefox-v1.0.0.zip",
    "types-react-19.2.7.tgz",
    "typescript-5.9.3.tgz"
)

function Get-Size($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    $sum = (Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) { return 0 }
    return [math]::Round($sum/1MB,2)
}

Write-Host "Preview: SAFE DELETE candidates (no action taken)" -ForegroundColor Cyan
Write-Host "Root: $Root" -ForegroundColor DarkCyan

$report = @()

foreach ($rel in $Candidates) {
    $p = Join-Path $Root $rel
    $size = Get-Size $p
    $report += [PSCustomObject]@{
        Type = "Directory"
        Path = $rel
        Exists = Test-Path -LiteralPath $p
        SizeMB = $size
        WhySafe = "Build/cache output; fully regeneratable"
    }
}

foreach ($rel in $LogFiles) {
    $p = Join-Path $Root $rel
    $size = Get-Size $p
    $report += [PSCustomObject]@{
        Type = "Log"
        Path = $rel
        Exists = Test-Path -LiteralPath $p
        SizeMB = $size
        WhySafe = "Old build logs; regeneratable"
    }
}

foreach ($rel in $Archives) {
    $p = Join-Path $Root $rel
    $size = Get-Size $p
    $report += [PSCustomObject]@{
        Type = "Archive"
        Path = $rel
        Exists = Test-Path -LiteralPath $p
        SizeMB = $size
        WhySafe = "Packed releases or cached tarballs"
    }
}

$report | Sort-Object Exists -Descending, SizeMB -Descending | Format-Table -AutoSize

if ($All) {
    Write-Host "\nNote: node_modules directories are large but excluded from preview by default." -ForegroundColor Yellow
    $nmRoot = Join-Path $Root "node_modules"
    $nmFunc = Join-Path $Root "functions/node_modules"
    $nmRootSize = Get-Size $nmRoot
    $nmFuncSize = Get-Size $nmFunc
    [PSCustomObject]@{ Type="Directory"; Path="node_modules/"; Exists=Test-Path $nmRoot; SizeMB=$nmRootSize; WhySafe="Dependencies; regenerate with npm ci" } | Format-Table -AutoSize
    [PSCustomObject]@{ Type="Directory"; Path="functions/node_modules/"; Exists=Test-Path $nmFunc; SizeMB=$nmFuncSize; WhySafe="Dependencies; regenerate with npm ci (functions)" } | Format-Table -AutoSize
}

Write-Host "\nNo files were deleted. Review and confirm before any action." -ForegroundColor Green
