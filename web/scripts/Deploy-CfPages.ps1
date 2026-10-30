#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy web/dist to Cloudflare Pages using PowerShell HTTP (Node fetch is blocked on this PC).
#>
param(
  [string]$ProjectName = "srez",
  [string]$AccountId = "332cc41c06a6b929bfa7725635ea43cb"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$tokenFile = "D:\Areas\Income\.cf-api-token"
if (-not $env:CLOUDFLARE_API_TOKEN -and (Test-Path $tokenFile)) {
  $env:CLOUDFLARE_API_TOKEN = (Get-Content $tokenFile -Raw).Trim()
}
if (-not $env:CLOUDFLARE_API_TOKEN) { throw "CLOUDFLARE_API_TOKEN missing" }

Write-Host "Building..."
npm run build | Out-Host
Write-Host "Hashing assets (blake3, offline)..."
node .\scripts\prepare-cf-upload.mjs | Out-Host

$payloadPath = Join-Path $Root "deploy-payload.json"
$payload = Get-Content $payloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
$auth = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)" }

Write-Host "Requesting upload JWT..."
$jwtResp = Invoke-RestMethod -Method GET `
  -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName/upload-token" `
  -Headers $auth
$jwt = $jwtResp.result.jwt
$jwtHeaders = @{
  Authorization = "Bearer $jwt"
  "Content-Type" = "application/json"
}

$hashes = @($payload.files | ForEach-Object { $_.hash })
Write-Host "Checking missing hashes ($($hashes.Count))..."
$missing = Invoke-RestMethod -Method POST `
  -Uri "https://api.cloudflare.com/client/v4/pages/assets/check-missing" `
  -Headers $jwtHeaders `
  -Body (@{ hashes = $hashes } | ConvertTo-Json -Compress)

$missingSet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($h in @($missing)) { [void]$missingSet.Add([string]$h) }
# API may wrap in .result
if ($missing.result) {
  $missingSet.Clear()
  foreach ($h in @($missing.result)) { [void]$missingSet.Add([string]$h) }
}

$toUpload = @($payload.files | Where-Object { $missingSet.Contains($_.hash) })
Write-Host "Uploading $($toUpload.Count) new files..."

if ($toUpload.Count -gt 0) {
  $bodyObj = @(
    $toUpload | ForEach-Object {
      @{
        key = $_.hash
        value = $_.base64
        metadata = @{ contentType = $_.contentType }
        base64 = $true
      }
    }
  )
  $null = Invoke-RestMethod -Method POST `
    -Uri "https://api.cloudflare.com/client/v4/pages/assets/upload" `
    -Headers $jwtHeaders `
    -Body ($bodyObj | ConvertTo-Json -Depth 6 -Compress)
}

Write-Host "Upserting hashes..."
try {
  $null = Invoke-RestMethod -Method POST `
    -Uri "https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes" `
    -Headers $jwtHeaders `
    -Body (@{ hashes = $hashes } | ConvertTo-Json -Compress)
} catch {
  Write-Warning "upsert-hashes failed (non-fatal): $($_.Exception.Message)"
}

Write-Host "Creating deployment..."
$boundary = [guid]::NewGuid().ToString("N")
$enc = [Text.Encoding]::UTF8
$ms = New-Object System.IO.MemoryStream

function Write-Part([string]$name, [string]$value) {
  $chunk = "--$boundary`r`nContent-Disposition: form-data; name=`"$name`"`r`n`r`n$value`r`n"
  $b = $enc.GetBytes($chunk)
  $ms.Write($b, 0, $b.Length)
}

function Write-FilePart([string]$name, [string]$fileName, [byte[]]$bytes) {
  $chunk = "--$boundary`r`nContent-Disposition: form-data; name=`"$name`"; filename=`"$fileName`"`r`nContent-Type: application/octet-stream`r`n`r`n"
  $b = $enc.GetBytes($chunk)
  $ms.Write($b, 0, $b.Length)
  $ms.Write($bytes, 0, $bytes.Length)
  $nl = $enc.GetBytes("`r`n")
  $ms.Write($nl, 0, $nl.Length)
}

$manifestJson = ($payload.manifest | ConvertTo-Json -Compress)
Write-Part "manifest" $manifestJson
Write-Part "branch" "main"
Write-Part "commit_dirty" "true"

$redirectsPath = Join-Path $Root "dist\_redirects"
if (Test-Path $redirectsPath) {
  Write-FilePart "_redirects" "_redirects" ([IO.File]::ReadAllBytes($redirectsPath))
}

$end = $enc.GetBytes("--$boundary--`r`n")
$ms.Write($end, 0, $end.Length)
$bodyBytes = $ms.ToArray()

$uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName/deployments"
$req = [Net.HttpWebRequest]::Create($uri)
$req.Method = "POST"
$req.Headers["Authorization"] = "Bearer $($env:CLOUDFLARE_API_TOKEN)"
$req.ContentType = "multipart/form-data; boundary=$boundary"
$req.ContentLength = $bodyBytes.Length
$req.Timeout = 300000
$stream = $req.GetRequestStream()
$stream.Write($bodyBytes, 0, $bodyBytes.Length)
$stream.Close()

try {
  $resp = $req.GetResponse()
  $reader = New-Object IO.StreamReader($resp.GetResponseStream())
  $text = $reader.ReadToEnd()
  $reader.Close(); $resp.Close()
  $json = $text | ConvertFrom-Json
  if (-not $json.success) { Write-Host $text; throw "Deploy failed" }
  Write-Host "OK: https://$ProjectName.pages.dev"
  Write-Host "Deployment URL: $($json.result.url)"
  $json.result | ConvertTo-Json -Depth 4
} catch [Net.WebException] {
  if ($_.Exception.Response) {
    $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host ($reader.ReadToEnd())
  }
  throw
}
