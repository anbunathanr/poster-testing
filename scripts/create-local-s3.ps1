# PowerShell script to create local S3 bucket using LocalStack
# Usage: .\scripts\create-local-s3.ps1

$ErrorActionPreference = "SilentlyContinue"

$ENDPOINT = "http://localhost:4566"
$BUCKET_NAME = "ai-testing-evidence-local"

Write-Host "Creating local S3 bucket..." -ForegroundColor Cyan
Write-Host "Endpoint: $ENDPOINT"
Write-Host "Bucket: $BUCKET_NAME"
Write-Host ""

# Create bucket
Write-Host "Creating S3 bucket..." -NoNewline
aws s3 mb s3://$BUCKET_NAME `
  --endpoint-url $ENDPOINT `
  2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓ S3 bucket created: $BUCKET_NAME" -ForegroundColor Green
} else {
    Write-Host " ✗ S3 bucket already exists or error occurred" -ForegroundColor Yellow
}

# List buckets
Write-Host ""
Write-Host "Listing all local S3 buckets:" -ForegroundColor Cyan
aws s3 ls --endpoint-url $ENDPOINT

Write-Host ""
Write-Host "Local S3 setup complete!" -ForegroundColor Green
Write-Host "Bucket is available at: $ENDPOINT"
