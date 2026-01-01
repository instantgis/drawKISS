Param()

# Set DATABASE_URL for this PowerShell session to point at the self-hosted
# Supabase Postgres running on the VPS (instantgis.cloud), using VPS_* values from
# .env.local.
#
# pgKISS itself only cares about `DATABASE_URL` / `SUPABASE_DB_URL` – it does
# *not* use Supabase HTTP service keys. This script is just a convenience to
# build the correct Postgres connection string for the VPS instance.

$envPath = Join-Path -Path $PSScriptRoot -ChildPath '..\..\.env.local'

if (-not (Test-Path $envPath)) {
  Write-Error ".env.local not found at $envPath. Create it and add VPS_* entries before using this script."
  exit 1
}

$lines = Get-Content -LiteralPath $envPath

# Required: VPS_SUPABASE_URL (e.g. https://supabase.saggini.cloud)
$vpsUrlLine = $lines | Where-Object { $_ -match '^VPS_SUPABASE_URL=' } | Select-Object -First 1
if (-not $vpsUrlLine) {
  Write-Error "VPS_SUPABASE_URL not found in .env.local. Add e.g. VPS_SUPABASE_URL=\"https://supabase.saggini.cloud\"."
  exit 1
}

# Required: VPS_DB_PASSWORD (Postgres password, typically same as POSTGRES_PASSWORD in docker/supabase/.env)
$pwdLine = $lines | Where-Object { $_ -match '^VPS_DB_PASSWORD=' } | Select-Object -First 1
if (-not $pwdLine) {
  Write-Error "VPS_DB_PASSWORD not found in .env.local. Add VPS_DB_PASSWORD to match the VPS Postgres password."
  exit 1
}

# Optional: VPS_DB_PORT (defaults to 5432 for direct Postgres access).
# Legacy: VPS_POOLER_PORT still accepted as a fallback to avoid breaking
# older .env.local files that may have configured the Supavisor port.
$dbPortLine = $lines | Where-Object { $_ -match '^VPS_DB_PORT=' } | Select-Object -First 1
$legacyPoolerPortLine = $lines | Where-Object { $_ -match '^VPS_POOLER_PORT=' } | Select-Object -First 1

# Use Split with max 2 parts to handle values containing '=' (like base64 passwords)
$vpsUrl = ($vpsUrlLine -split '=', 2)[1].Trim('"')
$postgresPassword = ($pwdLine -split '=', 2)[1].Trim('"')

if ([string]::IsNullOrWhiteSpace($vpsUrl) -or [string]::IsNullOrWhiteSpace($postgresPassword)) {
  Write-Error "One or more VPS_* values are empty. Check VPS_SUPABASE_URL and VPS_DB_PASSWORD in .env.local."
  exit 1
}

try {
  $uri = [Uri]$vpsUrl
} catch {
  Write-Error "VPS_SUPABASE_URL '$vpsUrl' is not a valid URL. Expected something like https://supabase.saggini.cloud."
  exit 1
}

$dbHost = $uri.Host
# For self-hosted Postgres on the VPS we can just use the plain `postgres`
# user. No tenant suffix required.
$dbUser = "postgres"

# Default to direct Postgres on 5432; allow overrides via VPS_DB_PORT, and as a
# legacy fallback respect VPS_POOLER_PORT if it is present.
$port = 5432
if ($dbPortLine) {
  $port = $dbPortLine.Split('=')[1].Trim('"')
} elseif ($legacyPoolerPortLine) {
  $port = $legacyPoolerPortLine.Split('=')[1].Trim('"')
}

$database = 'postgres'

# URL-encode the password to handle special characters like + and =
$encodedPassword = [System.Uri]::EscapeDataString($postgresPassword)

# Self-hosted Postgres on the VPS does not have SSL configured by default, so
# we use sslmode=disable here. This matches the local Docker Supabase setup.
$env:DATABASE_URL = "postgresql://${dbUser}:${encodedPassword}@${dbHost}:${port}/${database}?sslmode=disable"

Write-Host "[pgkiss] DATABASE_URL for this session (VPS): $env:DATABASE_URL" -ForegroundColor Green

