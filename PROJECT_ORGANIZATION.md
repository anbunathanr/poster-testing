# Project Organization Guide

## Current Structure (Before Migration)

```
ai-testing-automation-platform/
├── src/                    # Backend source code
├── tests/                  # Backend tests
├── infrastructure/         # AWS CDK
├── frontend/              # Frontend files ✅ (already organized)
├── config/                # Backend config
├── scripts/               # Backend scripts
├── docs/                  # Backend docs
├── package.json           # Backend dependencies
└── ... (other backend files)
```

## Target Structure (After Migration)

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
│   ├── infrastructure/   # AWS CDK
│   ├── config/           # Configuration
│   ├── scripts/          # Utility scripts
│   ├── events/           # Test events
│   ├── layers/           # Lambda layers
│   ├── docs/             # Documentation
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   ├── template.yaml
│   ├── docker-compose.yml
│   └── env.json
│
├── README.md             # Main project README
├── RESTRUCTURE_GUIDE.md  # This guide
├── migrate-to-new-structure.ps1
└── rollback-structure.ps1
```

## Migration Options

### Option 1: Automated Migration (Recommended)

Run the PowerShell script:

```powershell
.\migrate-to-new-structure.ps1
```

This will:
1. Create `backend/` directory
2. Move all backend files to `backend/`
3. Keep `frontend/` as is
4. Update README files
5. Provide next steps

### Option 2: Manual Migration

Follow the steps in `RESTRUCTURE_GUIDE.md`

### Option 3: Keep Current Structure

If you prefer the current structure, you can:
1. Delete the migration scripts
2. Continue working as before
3. Just remember that backend files are in root

## Why Reorganize?

### Benefits

1. **Clear Separation**: Frontend and backend are distinct
2. **Independent Deployment**: Deploy each part separately
3. **Easier Navigation**: Focus on one part at a time
4. **Better Scalability**: Easy to add more frontends
5. **Standard Practice**: Follows industry conventions
6. **Cleaner Root**: Root directory is less cluttered

### Considerations

1. **Path Updates**: Some scripts may need path updates
2. **CI/CD Changes**: Update deployment pipelines
3. **Documentation**: Update any custom docs
4. **Team Communication**: Inform team members

## Running the Project

### After Migration

**Backend:**
```powershell
cd backend
npm install
npm run local:dev
```

**Frontend:**
```powershell
cd frontend
# Open index.html or:
python -m http.server 8080
```

### Before Migration (Current)

**Backend:**
```powershell
npm install
npm run local:dev
```

**Frontend:**
```powershell
cd frontend
# Open index.html
```

## Rollback

If you need to undo the migration:

```powershell
.\rollback-structure.ps1
```

This will move all files back to the root directory.

## Decision Matrix

| Factor | Keep Current | Migrate |
|--------|-------------|---------|
| Simplicity | ✅ Simpler | ⚠️ Requires migration |
| Organization | ⚠️ Mixed files | ✅ Clear separation |
| Scalability | ⚠️ Limited | ✅ Easy to extend |
| Industry Standard | ⚠️ Non-standard | ✅ Standard practice |
| Deployment | ⚠️ Coupled | ✅ Independent |
| Team Size | ✅ Good for solo | ✅ Better for teams |

## Recommendation

**For Production Projects**: Migrate to the new structure
- Better organization
- Easier to maintain
- Standard practice
- Scales better

**For Quick Prototypes**: Keep current structure
- Less overhead
- Faster to work with
- Simpler for solo developers

## Next Steps

1. **Decide**: Choose to migrate or keep current structure
2. **Backup**: Create a backup if migrating
3. **Migrate**: Run the migration script if chosen
4. **Test**: Verify everything works
5. **Update**: Update any custom scripts/docs
6. **Commit**: Commit the changes to version control

## Support

If you encounter issues:
1. Check `RESTRUCTURE_GUIDE.md` for troubleshooting
2. Use the rollback script if needed
3. Review the migration script logs
4. Verify all files were moved correctly

---

**Created**: February 20, 2026
**Status**: Ready for use
