# GitHub + Jira Automation Setup

## Required GitHub Secrets

Go to **GitHub repo > Settings > Secrets and variables > Actions** and add:

| Secret | Value |
|--------|-------|
| `JIRA_BASE_URL` | `https://cobay.atlassian.net` |
| `JIRA_USER_EMAIL` | `jaisuriya@cobay.com` |
| `JIRA_API_TOKEN` | Generate at https://id.atlassian.com/manage-profile/security/api-tokens |

> `GITHUB_TOKEN` is provided automatically by GitHub Actions.

## How to Generate a Jira API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Label it `github-actions`
4. Copy the token and add it as `JIRA_API_TOKEN` secret in GitHub

## Workflow Overview

### 1. Create Branch (`create-branch.yml`)
- **Trigger:** Manual via Actions tab > "Create Branch from Jira Issue" > Run workflow
- **Input:** Jira issue key (e.g., `XPRMNTS-4`)
- **Does:** Creates branch `XPRMNTS-4-{summary-slug}`, transitions issue to In Progress, adds Jira comment

### 2. CI (`ci.yml`)
- **Trigger:** Push to main or PR to main
- **Does:** Validates HTML, checks JS syntax, warns about console.log/TODO comments

### 3. Commit Sync (`jira-commit-sync.yml`)
- **Trigger:** Push to any branch except main
- **Does:** Extracts issue key from branch name or commit message, adds commit details as Jira comment, transitions to In Progress

### 4. PR Merge + Release (`jira-pr-release.yml`)
- **Trigger:** PR merged to main
- **Does:** Extracts issue keys from PR title/body/branch, transitions to Done, creates GitHub release with Jira links

### 5. Weekly Metrics (`metrics.yml`)
- **Trigger:** Every Monday 9 AM UTC (or manual)
- **Measures:**
  - PRs merged, avg lead time to merge, lines changed
  - Deployment frequency (releases/week)
  - Bugs: open, created, resolved (from Jira)
  - DORA indicators summary
