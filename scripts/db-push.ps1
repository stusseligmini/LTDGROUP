Write-Host "Loading environment variables from .env.local..."

# Read .env.local file
$envFile = Get-Content ".env.local"

foreach ($line in $envFile) {
    # Skip comments and empty lines
    if ($line -match '^\s*#' -or $line -match '^\s*$') {
        continue
    }
    
    # Match KEY=VALUE pattern
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        
        # Remove quotes if present
        $value = $value -replace '^"(.*)"$', '$1'
        
        # Set environment variable
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
        Write-Host "Set $key"
    }
}

Write-Host "`nRunning Prisma DB Push..."
npx prisma db push --accept-data-loss
