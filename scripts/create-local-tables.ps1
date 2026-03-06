# PowerShell script to create local DynamoDB tables for development
# Usage: .\scripts\create-local-tables.ps1

$ErrorActionPreference = "SilentlyContinue"

$ENDPOINT = "http://localhost:8000"
$REGION = "us-east-1"

Write-Host "Creating local DynamoDB tables..." -ForegroundColor Cyan
Write-Host "Endpoint: $ENDPOINT"
Write-Host ""

# Create Users Table
Write-Host "Creating Users table..." -NoNewline
aws dynamodb create-table `
  --table-name ai-testing-users-local `
  --attribute-definitions `
    AttributeName=userId,AttributeType=S `
    AttributeName=tenantId,AttributeType=S `
    AttributeName=email,AttributeType=S `
  --key-schema `
    AttributeName=userId,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --global-secondary-indexes `
    "[{`"IndexName`":`"tenantId-email-index`",`"KeySchema`":[{`"AttributeName`":`"tenantId`",`"KeyType`":`"HASH`"},{`"AttributeName`":`"email`",`"KeyType`":`"RANGE`"}],`"Projection`":{`"ProjectionType`":`"ALL`"}}]" `
  --endpoint-url $ENDPOINT `
  --region $REGION `
  2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓ Users table created" -ForegroundColor Green
} else {
    Write-Host " ✗ Users table already exists or error occurred" -ForegroundColor Yellow
}

# Create Tests Table
Write-Host "Creating Tests table..." -NoNewline
aws dynamodb create-table `
  --table-name ai-testing-tests-local `
  --attribute-definitions `
    AttributeName=tenantId,AttributeType=S `
    AttributeName=testId,AttributeType=S `
    AttributeName=userId,AttributeType=S `
    AttributeName=createdAt,AttributeType=N `
  --key-schema `
    AttributeName=tenantId,KeyType=HASH `
    AttributeName=testId,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST `
  --global-secondary-indexes `
    "[{`"IndexName`":`"userId-createdAt-index`",`"KeySchema`":[{`"AttributeName`":`"userId`",`"KeyType`":`"HASH`"},{`"AttributeName`":`"createdAt`",`"KeyType`":`"RANGE`"}],`"Projection`":{`"ProjectionType`":`"ALL`"}}]" `
  --endpoint-url $ENDPOINT `
  --region $REGION `
  2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓ Tests table created" -ForegroundColor Green
} else {
    Write-Host " ✗ Tests table already exists or error occurred" -ForegroundColor Yellow
}

# Create TestResults Table
Write-Host "Creating TestResults table..." -NoNewline
aws dynamodb create-table `
  --table-name ai-testing-results-local `
  --attribute-definitions `
    AttributeName=tenantId,AttributeType=S `
    AttributeName=resultId,AttributeType=S `
    AttributeName=testId,AttributeType=S `
    AttributeName=startTime,AttributeType=N `
  --key-schema `
    AttributeName=tenantId,KeyType=HASH `
    AttributeName=resultId,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST `
  --global-secondary-indexes `
    "[{`"IndexName`":`"testId-startTime-index`",`"KeySchema`":[{`"AttributeName`":`"testId`",`"KeyType`":`"HASH`"},{`"AttributeName`":`"startTime`",`"KeyType`":`"RANGE`"}],`"Projection`":{`"ProjectionType`":`"ALL`"}}]" `
  --endpoint-url $ENDPOINT `
  --region $REGION `
  2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓ TestResults table created" -ForegroundColor Green
} else {
    Write-Host " ✗ TestResults table already exists or error occurred" -ForegroundColor Yellow
}

# Create Environments Table
Write-Host "Creating Environments table..." -NoNewline
aws dynamodb create-table `
  --table-name ai-testing-environments-local `
  --attribute-definitions `
    AttributeName=tenantId,AttributeType=S `
    AttributeName=environment,AttributeType=S `
  --key-schema `
    AttributeName=tenantId,KeyType=HASH `
    AttributeName=environment,KeyType=RANGE `
  --billing-mode PAY_PER_REQUEST `
  --endpoint-url $ENDPOINT `
  --region $REGION `
  2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓ Environments table created" -ForegroundColor Green
} else {
    Write-Host " ✗ Environments table already exists or error occurred" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Listing all local tables:" -ForegroundColor Cyan
aws dynamodb list-tables --endpoint-url $ENDPOINT --region $REGION

Write-Host ""
Write-Host "Local DynamoDB setup complete!" -ForegroundColor Green
Write-Host "Tables are available at: $ENDPOINT"
