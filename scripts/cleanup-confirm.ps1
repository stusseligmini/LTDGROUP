# Guarded cleanup of regeneratable build/cache artifacts
# Prompts before deleting; skips if missing or in use

Param(
    [switch]$IncludeNodeModules
)

$Root = Split-Path -Parent $PSScriptRoot

$Dirs = @(
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

$Logs = @(
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

if ($IncludeNodeModules) {
    $Dirs += "node_modules"
    $Dirs += "functions/node_modules"
}

function SizeMB($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    $sum = (Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) { return 0 }
    return [math]::Round($sum/1MB,2)
}

$items = @()
foreach ($rel in $Dirs) {
    $p = Join-Path $Root $rel
    if (Test-Path -LiteralPath $p) {
        $items += [PSCustomObject]@{ Type="Directory"; Path=$p; Rel=$rel; SizeMB=(SizeMB $p) }
    }
}
foreach ($rel in $Logs) {
    $p = Join-Path $Root $rel
    if (Test-Path -LiteralPath $p) {
        $items += [PSCustomObject]@{ Type="Log"; Path=$p; Rel=$rel; SizeMB=(SizeMB $p) }
    }
}
foreach ($rel in $Archives) {
    $p = Join-Path $Root $rel
    if (Test-Path -LiteralPath $p) {
        $items += [PSCustomObject]@{ Type="Archive"; Path=$p; Rel=$rel; SizeMB=(SizeMB $p) }
    }
}

if ($items.Count -eq 0) {
    Write-Host "Nothing to clean." -ForegroundColor Green
    exit 0
}

Write-Host "Candidates (regeneratable):" -ForegroundColor Cyan
$items | Sort-Object SizeMB -Descending | Format-Table Type,Rel,SizeMB -AutoSize

$total = [math]::Round(($items | Measure-Object -Property SizeMB -Sum).Sum, 2)
Write-Host "Total potential freed: $total MB" -ForegroundColor DarkCyan

$confirm = Read-Host "Proceed to delete these items? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted by user. No changes made." -ForegroundColor Yellow
    exit 0
}

foreach ($item in $items) {
    try {
        if ($item.Type -eq "Directory") {
            Remove-Item -LiteralPath $item.Path -Recurse -Force -ErrorAction Stop
            Write-Host "Deleted directory: $($item.Rel)" -ForegroundColor Green
        } elseif ($item.Type -eq "Log" -or $item.Type -eq "Archive") {
            Remove-Item -LiteralPath $item.Path -Force -ErrorAction Stop
            Write-Host "Deleted file: $($item.Rel)" -ForegroundColor Green
        }
    } catch {
        Write-Host "Skip (in use or protected): $($item.Rel) -> $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "Cleanup complete." -ForegroundColor Green
