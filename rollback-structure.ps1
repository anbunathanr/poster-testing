# Rollback Script: Restore Original Project Structure
# Moves backend files back to root directory

Write-Host "🔄 Starting rollback to original structure..." -ForegroundColor Cyan
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path "backend")) {
    Write-Host "❌ Backend directory not found. Nothing to rollback." -ForegroundColor Red
    exit 1
}

Write-Host "⚠️  This will move all files from backend/ to root directory" -ForegroundColor Yellow
$response = Read-Host "Do you want to continue? (y/N)"
if ($response -ne "y" -and $response -ne "Y") {
    Write-Host "❌ Rollback cancelled." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Moving backend files to root..." -ForegroundColor Green

# Get all items in backend directory
$backendItems = Get-ChildItem -Path "backend" -Force

foreach ($item in $backendItems) {
    $itemName = $item.Name
    
    # Skip README.md created during migration
    if ($itemName -eq "README.md") {
        continue
    }
    
    Write-Host "  Moving $itemName..." -ForegroundColor Gray
    
    # Remove existing item in root if it exists
    if (Test-Path $itemName) {
        Remove-Item -Path $itemName -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Move item to root
    Move-Item -Path "backend/$itemName" -Destination "." -Force -ErrorAction SilentlyContinue
}

# Remove backend directory
Write-Host "🗑️  Removing backend directory..." -ForegroundColor Green
Remove-Item -Path "backend" -Recurse -Force -ErrorAction SilentlyContinue

# Restore original README if backup exists
if (Test-Path "README.md.backup") {
    Write-Host "📝 Restoring original README..." -ForegroundColor Green
    Move-Item -Path "README.md.backup" -Destination "README.md" -Force
}

Write-Host ""
Write-Host "✅ Rollback complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. npm install" -ForegroundColor White
Write-Host "  2. npm test" -ForegroundColor White
Write-Host "  3. npm run local:dev" -ForegroundColor White
Write-Host ""
