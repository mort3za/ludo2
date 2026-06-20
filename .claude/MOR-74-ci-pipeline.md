# MOR-74 CI Pipeline (GitHub Actions)

## Implementation

Created `.github/workflows/test.yml` with:

- Triggers: push to main, pull_request to main
- Runs on ubuntu-latest with latest Bun
- Caches `~/.bun/install/cache` keyed on `bun.lockb`
- Steps: install (frozen-lockfile) → typecheck → lint → test

## Branch Protection Setup

To require the CI check to pass before merging to main:

1. Go to repository Settings > Branches
2. Click "Add rule" under Branch protection rules
3. Set branch name pattern to `main`
4. Enable "Require status checks to pass before merging"
5. Search for and select "test" (the workflow job)
6. Optionally enable "Dismiss stale pull request approvals" and "Require branches to be up to date before merging"

The workflow will automatically report status to all PRs and pushes to main.
