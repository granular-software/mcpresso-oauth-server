# Safe Subtree Workflow Guide

## TL;DR - What You Need to Know

✅ **Your existing workflow is now safe!** Just keep using:
- `bun run publish` - for packages (mcpresso, oauth-server, etc.)
- `bun run publish-template` - for templates

🔧 **What Changed:** These commands now pull remote changes first, merge properly, and never overwrite others' work.

⚠️ **If conflicts occur:** The script will guide you through resolving them manually.

---

## The Problem

The original workflow had a critical flaw: **it used force push when normal push failed**, which would overwrite other people's changes without merging them first. This caused data loss and conflicts.

## The Solution

The new `sync-subtree.js` script implements a **pull-first, merge-aware workflow** that:

1. ✅ **Always pulls remote changes first**
2. ✅ **Handles merge conflicts gracefully** 
3. ✅ **Never overwrites others' work** (unless explicitly forced)
4. ✅ **Provides clear guidance** when conflicts occur

## Quick Start

### Recommended Commands (Safe)

```bash
# High-level publishing (most common) - handles version bump + sync
bun run publish                     # For packages (mcpresso, oauth-server, etc.)  
bun run publish-template            # For templates (template-express-oauth-sqlite, etc.)

# Manual sync commands (if needed)
npm run sync:mcpresso               # Sync a specific project (pull + merge + push)
npm run sync:all                    # Sync all projects at once
npm run pull:mcpresso               # Only pull changes (no push)
```

### When to Use What

| Command | When to Use | Safety Level |
|---------|-------------|--------------|
| `bun run publish` | **Publishing packages** - version bump + safe sync | ✅ Safe |
| `bun run publish-template` | **Publishing templates** - version bump + safe sync | ✅ Safe |
| `npm run sync:PROJECT` | Manual sync specific project | ✅ Safe |
| `npm run sync:all` | Manual sync all projects | ✅ Safe |
| `npm run pull:PROJECT` | Only get others' changes | ✅ Safe |
| `npm run push:PROJECT` | Only push (not recommended) | ⚠️ Risky |
| `node scripts/sync-subtree.js PROJECT --force` | Overwrite remote changes | ❌ Dangerous |

## Daily Workflow

### 1. Before Making Changes
```bash
# Pull latest changes from all subtree repos
npm run sync:all
```

### 2. Publishing Changes (Most Common)
```bash
# For packages (mcpresso, oauth-server, openapi-generator)
bun run publish

# For templates (template-express-oauth-sqlite, etc.)
bun run publish-template
```

### 3. Manual Sync (If Needed)
```bash
# Sync specific project without version bump
npm run sync:mcpresso

# Or sync all if you changed multiple projects
npm run sync:all
```

### 4. If Someone Else Pushed While You Were Working
```bash
# The publish commands will automatically handle this
bun run publish

# Or manual sync will pull their changes and merge with yours
npm run sync:mcpresso
```

## Handling Merge Conflicts

### When Conflicts Occur

If someone else modified the same files you did, you'll see:

```
⚠️  Merge conflicts detected in mcpresso
📝 Please resolve conflicts in packages/mcpresso/ and then run:
   git add packages/mcpresso/
   git commit -m "resolve: merge conflicts in mcpresso"
   npm run sync:mcpresso
```

### How to Resolve Conflicts

1. **Open the conflicted files** in your editor
2. **Look for conflict markers**:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Their changes
   >>>>>>> [commit hash]
   ```
3. **Manually merge the changes** by editing the file to include both sets of changes
4. **Remove the conflict markers** (`<<<<<<<`, `=======`, `>>>>>>>`)
5. **Add and commit the resolved files**:
   ```bash
   git add packages/mcpresso/
   git commit -m "resolve: merge conflicts in mcpresso"
   ```
6. **Re-run the sync**:
   ```bash
   npm run sync:mcpresso
   ```

### Example Conflict Resolution

**Before (conflicted file):**
```typescript
<<<<<<< HEAD
export const API_VERSION = "v2.1";
=======
export const API_VERSION = "v2.0";
>>>>>>> abc123def
```

**After (resolved):**
```typescript
export const API_VERSION = "v2.1"; // Keep the newer version
```

## Advanced Usage

### Check Status Before Syncing
```bash
npm run check:subtrees
```

This shows you which projects have:
- Uncommitted changes
- Commits to push
- Commits to pull

### Pull-Only Mode
```bash
# Only get remote changes, don't push anything
npm run pull:mcpresso
npm run pull:all
```

### Push-Only Mode (Not Recommended)
```bash
# Only push local changes, don't pull first
# ⚠️ This can cause conflicts - use sync instead
npm run push:mcpresso
```

### Force Mode (Dangerous)
```bash
# Overwrite remote changes completely
# ❌ Only use if you're absolutely sure
node scripts/sync-subtree.js mcpresso --force
```

## Troubleshooting

### "Working tree is not clean"
```bash
# You have uncommitted changes
git status
git add .
git commit -m "feat: your changes"
npm run sync:mcpresso
```

### "Push failed - someone else has pushed changes"
```bash
# This is normal - just run sync to merge their changes
npm run sync:mcpresso
```

### "Command failed" errors
```bash
# Check your network connection and GitHub access
ssh -T git@github.com

# Ensure you have the latest script
git pull origin main
```

### Emergency: Accidentally Force Pushed
1. **Don't panic** - the old commits still exist
2. **Contact the other person** to get their commit hashes
3. **Use git to restore their commits**:
   ```bash
   cd packages/mcpresso
   git log --oneline -10  # Find their commits
   git cherry-pick THEIR_COMMIT_HASH
   git push origin main
   ```

## Best Practices

### 1. Sync Before Starting Work
```bash
npm run sync:all
```

### 2. Sync After Each Logical Change
```bash
# Make changes to packages/mcpresso/
git add packages/mcpresso/
git commit -m "feat: add new feature"
npm run sync:mcpresso
```

### 3. Use Descriptive Commit Messages
```bash
git commit -m "feat: add OAuth2 PKCE support"
git commit -m "fix: handle edge case in token validation"
git commit -m "docs: update README with new examples"
```

### 4. Resolve Conflicts Promptly
- Don't let conflicts accumulate
- Communicate with team members when conflicts occur
- Test your merged changes before pushing

### 5. Regular Maintenance
```bash
# Check status of all subtrees weekly
npm run check:subtrees

# Sync all projects daily
npm run sync:all
```

## Migration from Old Workflow

### Old Commands → New Commands
```bash
# OLD (dangerous)
npm run push:mcpresso

# NEW (safe)
npm run sync:mcpresso

# OLD (manual)
git subtree pull --prefix=packages/mcpresso git@github.com:granular-software/mcpresso.git main --squash

# NEW (automated)
npm run pull:mcpresso
```

### Updating Your Habits
1. Replace `push:*` commands with `sync:*`
2. Always run `sync` instead of `push`
3. Use `pull:*` only when you want to get changes without pushing
4. Never use `--force` unless you understand the consequences

## FAQ

### Q: What if I need to force push?
**A:** Use `node scripts/sync-subtree.js PROJECT --force`, but understand this **will overwrite remote changes**. Only do this if you've coordinated with your team.

### Q: Can I sync multiple projects at once?
**A:** Yes! Use `npm run sync:all` to sync all subtree projects.

### Q: What if the sync takes a long time?
**A:** The script fetches from remote repos, which can be slow. This is normal for the first run or after many changes.

### Q: Can I see what changes will be synced?
**A:** Yes, run `npm run check:subtrees` first to see the status of each project.

### Q: What if I'm working offline?
**A:** You can still make local commits. When you're back online, run `npm run sync:PROJECT` to push your changes.

## Summary

The new workflow ensures **no data loss** by:
- ✅ Always pulling before pushing
- ✅ Handling merge conflicts gracefully  
- ✅ Providing clear error messages
- ✅ Supporting safe force push when needed
- ✅ Offering multiple sync modes for different scenarios

**Remember: When in doubt, use `npm run sync:PROJECT` - it's the safest option!**