# Migration Script: Reorganize Project Structure
# Separates frontend and backend into distinct directories

Write-Host "🚀 Starting project restructure..." -ForegroundColor Cyan
Write-Host ""

# Check if backend directory already exists
if (Test-Path "backend") {
    Write-Host "⚠️  Backend directory already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to continue? This will overwrite existing files. (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "❌ Migration cancelled." -ForegroundColor Red
        exit 1
    }
}

# Create backend directory
Write-Host "📁 Creating backend directory..." -ForegroundColor Green
New-Item -ItemType Directory -Path "backend" -Force | Out-Null

# Move backend files
Write-Host "📦 Moving backend files..." -ForegroundColor Green

$backendItems = @(
    "src",
    "tests",
    "infrastructure",
    "config",
    "scripts",
    "events",
    "layers",
    "docs",
    "dist",
    "coverage",
    "node_modules",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "jest.config.js",
    "template.yaml",
    "docker-compose.yml",
    "env.json",
    ".env.example",
    ".eslintrc.json",
    ".eslintignore",
    ".prettierrc.json",
    ".prettierignore"
)

foreach ($item in $backendItems) {
    if (Test-Path $item) {
        Write-Host "  Moving $item..." -ForegroundColor Gray
        Move-Item -Path $item -Destination "backend/" -Force -ErrorAction SilentlyContinue
    }
}

# Keep frontend directory as is (already in correct location)
Write-Host "✅ Frontend directory already in correct location" -ForegroundColor Green

# Create backend README
Write-Host "📝 Creating backend README..." -ForegroundColor Green
@"
# AI Testing Platform - Backend

Backend API for the AI Testing Automation Platform.

## Quick Start

\`\`\`powershell
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Start local API
npm run local:dev
\`\`\`

## Documentation

See the \`docs/\` directory for detailed documentation.

## Project Structure

\`\`\`
backend/
├── src/              # Source code
├── tests/            # Test files
├── infrastructure/   # AWS CDK
├── config/           # Configuration
├── scripts/          # Utility scripts
├── events/           # Test events
├── layers/           # Lambda layers
└── docs/             # Documentation
\`\`\`

For more information, see the main project README.
"@ | Out-File -FilePath "backend/README.md" -Encoding UTF8

# Update root README
Write-Host "📝 Updating root README..." -ForegroundColor Green
@"
# AI Testing Automation Platform

An intelligent, scalable testing platform that combines AI-driven test generation with automated UI testing.

## Project Structure

\`\`\`
ai-testing-automation-platform/
├── frontend/          # Frontend web application
├── backend/           # Backend API and services
└── docs/              # Shared documentation
\`\`\`

## Quick Start

### Backend

\`\`\`powershell
cd backend
npm install
npm run local:dev
\`\`\`

API will be available at: http://localhost:3000

### Frontend

\`\`\`powershell
cd frontend
# Open index.html in your browser
# Or use a local server:
python -m http.server 8080
\`\`\`

Frontend will be available at: http://localhost:8080

## Documentation

- **Frontend**: See \`frontend/README.md\`
- **Backend**: See \`backend/README.md\` and \`backend/docs/\`
- **API Documentation**: See \`backend/docs/API_DOCUMENTATION.md\`
- **Deployment**: See \`backend/AWS_DEPLOYMENT_GUIDE.md\`

## Features

- 🤖 AI-powered test generation using Amazon Bedrock
- ▶️ Automated UI testing with Playwright
- 🔐 Secure multi-tenant architecture
- 📊 Comprehensive test reporting
- 🔔 Real-time notifications
- ☁️ Serverless AWS infrastructure

## Technology Stack

**Frontend**:
- HTML5, CSS3, JavaScript (Vanilla)
- No build tools required

**Backend**:
- Node.js 18+ with TypeScript
- AWS Lambda, DynamoDB, S3
- Amazon Bedrock (Claude 3.5 Sonnet)
- Playwright for browser automation

## Development

### Prerequisites

- Node.js 18+
- Docker Desktop (for LocalStack)
- AWS CLI (for deployment)
- AWS SAM CLI (for local development)

### Setup

1. Clone the repository
2. Set up backend: \`cd backend && npm install\`
3. Start LocalStack: \`cd backend && docker-compose up -d\`
4. Create tables: \`cd backend && npm run local:setup:tables\`
5. Start API: \`cd backend && npm run local:dev\`
6. Open frontend: \`cd frontend\` and open \`index.html\`

## Testing

\`\`\`powershell
cd backend
npm test                # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
\`\`\`

## Deployment

See \`backend/AWS_DEPLOYMENT_GUIDE.md\` for detailed deployment instructions.

Quick deploy:

\`\`\`powershell
cd backend/infrastructure
cdk deploy --context environment=dev
\`\`\`

## License

MIT

## Support

For issues and questions, see the documentation in \`backend/docs/\`.
"@ | Out-File -FilePath "README.md" -Encoding UTF8 -Force

Write-Host ""
Write-Host "✅ Migration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. cd backend && npm install" -ForegroundColor White
Write-Host "  2. cd backend && npm test" -ForegroundColor White
Write-Host "  3. cd backend && npm run local:dev" -ForegroundColor White
Write-Host "  4. Open frontend/index.html in your browser" -ForegroundColor White
Write-Host ""
Write-Host "📚 See RESTRUCTURE_GUIDE.md for more information" -ForegroundColor Cyan
