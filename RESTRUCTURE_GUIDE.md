# Project Restructure Guide

## Overview

The project has been reorganized to clearly separate frontend and backend code:

```
ai-testing-automation-platform/
├── frontend/              # Frontend application
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── README.md
│
├── backend/               # Backend application
│   ├── src/              # Source code
│   ├── tests/            # Test files
│   ├── infrastructure/   # AWS CDK/IaC
│   ├── config/           # Configuration files
│   ├── scripts/          # Utility scripts
│   ├── events/           # Test event payloads
│   ├── layers/           # Lambda layers
│   ├── docs/             # Backend documentation
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   ├── template.yaml     # SAM template
│   ├── docker-compose.yml
│   └── env.json
│
└── docs/                 # Shared documentation
    └── PROJECT_STRUCTURE.md
```

## Migration Steps

### Automated Migration (Recommended)

Run the PowerShell migration script:

```powershell
.\migrate-to-new-structure.ps1
```

### Manual Migration

If you prefer to migrate manually:

#### 1. Create Backend Directory

```powershell
New-Item -ItemType Directory -Path backend -Force
```

#### 2. Move Backend Files

```powershell
# Move source code
Move-Item -Path src -Destination backend/

# Move tests
Move-Item -Path tests -Destination backend/

# Move infrastructure
Move-Item -Path infrastructure -Destination backend/

# Move configuration
Move-Item -Path config -Destination backend/
Move-Item -Path env.json -Destination backend/
Move-Item -Path .env.example -Destination backend/

# Move scripts
Move-Item -Path scripts -Destination backend/

# Move events
Move-Item -Path events -Destination backend/

# Move layers
Move-Item -Path layers -Destination backend/

# Move build files
Move-Item -Path package.json -Destination backend/
Move-Item -Path package-lock.json -Destination backend/
Move-Item -Path tsconfig.json -Destination backend/
Move-Item -Path jest.config.js -Destination backend/
Move-Item -Path template.yaml -Destination backend/
Move-Item -Path docker-compose.yml -Destination backend/

# Move linting/formatting configs
Move-Item -Path .eslintrc.json -Destination backend/
Move-Item -Path .eslintignore -Destination backend/
Move-Item -Path .prettierrc.json -Destination backend/
Move-Item -Path .prettierignore -Destination backend/

# Move backend-specific docs
Move-Item -Path docs -Destination backend/
```

#### 3. Update Node Modules

```powershell
cd backend
npm install
```

#### 4. Update Scripts

The backend scripts in `package.json` remain the same, but you'll run them from the `backend/` directory.

## Updated Commands

### Backend Commands

All backend commands now run from the `backend/` directory:

```powershell
# Navigate to backend
cd backend

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
npm run test:unit
npm run test:integration

# Start local API
npm run local:dev

# Deploy
cd infrastructure
cdk deploy --context environment=dev
```

### Frontend Commands

Frontend runs independently:

```powershell
# Navigate to frontend
cd frontend

# Open in browser (double-click index.html)
# Or use a local server:
python -m http.server 8080
```

## Configuration Updates

### Frontend Configuration

Update `frontend/app.js` if your backend runs on a different port:

```javascript
const API_BASE_URL = 'http://localhost:3000';
```

### Backend Configuration

No changes needed - all paths are relative within the backend directory.

## Benefits of New Structure

1. **Clear Separation**: Frontend and backend are completely separated
2. **Independent Deployment**: Deploy frontend and backend separately
3. **Easier Navigation**: Developers can focus on one part at a time
4. **Better Organization**: Each part has its own dependencies and configuration
5. **Scalability**: Easy to add more frontends (mobile app, admin panel, etc.)

## Rollback

If you need to rollback to the old structure:

```powershell
.\rollback-structure.ps1
```

Or manually move files back to the root directory.

## CI/CD Updates

Update your CI/CD pipelines to:

1. Build backend from `backend/` directory
2. Deploy frontend from `frontend/` directory
3. Run tests from `backend/` directory

Example GitHub Actions update:

```yaml
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install backend dependencies
        working-directory: ./backend
        run: npm install
      - name: Run backend tests
        working-directory: ./backend
        run: npm test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy frontend
        working-directory: ./frontend
        run: |
          # Deploy to S3 or hosting service
```

## Troubleshooting

### "Module not found" errors

Make sure you're in the correct directory:
- Backend commands: `cd backend`
- Frontend: `cd frontend`

### Import path errors

All backend imports remain the same since they're relative within the backend directory.

### SAM/CDK errors

Make sure to run SAM/CDK commands from the `backend/` directory:

```powershell
cd backend
sam local start-api
```

Or:

```powershell
cd backend/infrastructure
cdk deploy
```

## Next Steps

1. Run the migration script or manually migrate files
2. Test the backend: `cd backend && npm test`
3. Test the frontend: Open `frontend/index.html`
4. Update any custom scripts or documentation
5. Update CI/CD pipelines if applicable

---

**Migration Date**: February 20, 2026
**Status**: Ready for migration
