# Complete Local Development Setup for Windows
# This script sets up Docker containers and creates all necessary tables and buckets

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Testing Platform - Local Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -NoNewline
docker ps 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host " ✗ Docker is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    Write-Host "After Docker Desktop is running, run this script again:" -ForegroundColor Yellow
    Write-Host "  .\scripts\setup-local-windows.ps1" -ForegroundColor White
    exit 1
}
Write-Host " ✓ Docker is running" -ForegroundColor Green

# Start Docker Compose services
Write-Host ""
Write-Host "Starting Docker services (DynamoDB Local, LocalStack, DynamoDB Admin)..." -ForegroundColor Cyan
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start Docker services" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Docker services started" -ForegroundColor Green

# Wait for services to be ready
Write-Host ""
Write-Host "Waiting for services to be ready (10 seconds)..." -NoNewline
Start-Sleep -Seconds 10
Write-Host " ✓ Ready" -ForegroundColor Green

# Create DynamoDB tables
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating DynamoDB Tables" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
& "$PSScriptRoot\create-local-tables.ps1"

# Create S3 bucket
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Creating S3 Bucket" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
& "$PSScriptRoot\create-local-s3.ps1"

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Local services are running:" -ForegroundColor Cyan
Write-Host "  • DynamoDB Local:    http://localhost:8000" -ForegroundColor White
Write-Host "  • DynamoDB Admin UI: http://localhost:8001" -ForegroundColor White
Write-Host "  • LocalStack (S3):   http://localhost:4566" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Build the project:  npm run build" -ForegroundColor White
Write-Host "  2. Run all tests:      npm test" -ForegroundColor White
Write-Host "  3. Start SAM API:      npm run local:dev" -ForegroundColor White
Write-Host ""
Write-Host "To stop services:        docker-compose down" -ForegroundColor Yellow
Write-Host "To clean all data:       docker-compose down -v" -ForegroundColor Yellow
Write-Host ""
