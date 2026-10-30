#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy Vite dist/ to Cloudflare Pages via REST (PowerShell), without wrangler/node fetch.
#>
param(
  [string]$ProjectName = "srez",
  [string]$DistDir = (Join-Path $PSScriptRoot "..\dist"),
  [string]$AccountId = $env:CLOUDFLARE_ACCOUNT_ID
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$tokenFile = "D:\Areas\Income\.cf-api-token"
if (-not $env:CLOUDFLARE_API_TOKEN -and (Test-Path $tokenFile)) {
  $env:CLOUDFLARE_API_TOKEN = (Get-Content $tokenFile -Raw).Trim()
}
if (-not $env:CLOUDFLARE_API_TOKEN) { throw "CLOUDFLARE_API_TOKEN missing" }
if (-not $AccountId) { $AccountId = "332cc41c06a6b929bfa7725635ea43cb" }

$DistDir = (Resolve-Path $DistDir).Path
if (-not (Test-Path $DistDir)) { throw "dist not found: $DistDir" }

$headers = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)" }

# Collect files
$files = Get-ChildItem -Path $DistDir -Recurse -File
Write-Host "Uploading $($files.Count) files from $DistDir to Pages project '$ProjectName'..."

# Build multipart body manually
$boundary = [guid]::NewGuid().ToString("N")
$enc = [Text.Encoding]::UTF8
$ms = New-Object System.IO.MemoryStream

function Add-TextPart($name, $value) {
  $prefix = "--$boundary`r`nContent-Disposition: form-data; name=`"$name`"`r`n`r`n$value`r`n"
  $bytes = $enc.GetBytes($prefix)
  $ms.Write($bytes, 0, $bytes.Length)
}

function Add-FilePart($fieldName, $relativePath, $fullPath) {
  $fileName = $relativePath.Replace("\", "/")
  $header = "--$boundary`r`nContent-Disposition: form-data; name=`"$fieldName`"; filename=`"$fileName`"`r`nContent-Type: application/octet-stream`r`n`r`n"
  $hb = $enc.GetBytes($header)
  $ms.Write($hb, 0, $hb.Length)
  $fb = [IO.File]::ReadAllBytes($fullPath)
  $ms.Write($fb, 0, $fb.Length)
  $nl = $enc.GetBytes("`r`n")
  $ms.Write($nl, 0, $nl.Length)
}

Add-TextPart "branch" "main"

foreach ($f in $files) {
  $rel = $f.FullName.Substring($DistDir.Length).TrimStart("\", "/")
  # Cloudflare Pages direct upload expects path as the form field name
  Add-FilePart $rel $rel $f.FullName
}

$end = $enc.GetBytes("--$boundary--`r`n")
$ms.Write($end, 0, $end.Length)
$body = $ms.ToArray()

$uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName/deployments"
$req = [Net.HttpWebRequest]::Create($uri)
$req.Method = "POST"
$req.Headers["Authorization"] = "Bearer $($env:CLOUDFLARE_API_TOKEN)"
$req.ContentType = "multipart/form-data; boundary=$boundary"
$req.ContentLength = $body.Length
$req.Timeout = 300000
$stream = $req.GetRequestStream()
$stream.Write($body, 0, $body.Length)
$stream.Close()

try {
  $resp = $req.GetResponse()
  $reader = New-Object IO.StreamReader($resp.GetResponseStream())
  $text = $reader.ReadToEnd()
  $reader.Close()
  $resp.Close()
  $json = $text | ConvertFrom-Json
  if (-not $json.success) {
    Write-Host $text
    throw "Deploy failed"
  }
  $url = $json.result.url
  $proj = $json.result.project_name
  Write-Host "OK deployment: $url"
  Write-Host "Project: https://$ProjectName.pages.dev"
  return $json.result
} catch [Net.WebException] {
  $errResp = $_.Exception.Response
  if ($errResp) {
    $reader = New-Object IO.StreamReader($errResp.GetResponseStream())
    Write-Host ($reader.ReadToEnd())
  }
  throw
}
