# Jira Pipeline Automation - Setup Guide

## Repo Structure

```
.github/
├── release.yml                  # GitHub auto-generated release notes config
└── workflows/
    └── jira-pipeline.yml        # Combined Jira + Deploy + Slack automation
```

## Required Secrets

Add these in **Settings > Secrets and variables > Actions > Secrets**:

| Secret | Description |
|--------|-------------|
| `JIRA_BASE_URL` | Jira instance URL (e.g. `https://yourteam.atlassian.net`) |
| `JIRA_EMAIL` | Jira account email for API auth |
| `JIRA_API_TOKEN` | Jira API token ([Generate here](https://id.atlassian.com/manage-profile/security/api-tokens)) |
| `STAGING_SLACK_WEBHOOK_URL` | Slack webhook for staging deploy notifications |
| `RELEASE_SLACK_WEBHOOK_URL` | Slack webhook for production release notifications |

> `GITHUB_TOKEN` is auto-provided by GitHub Actions — no setup needed.

## Required Variables

Add these in **Settings > Secrets and variables > Actions > Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `JIRA_PROJECT_KEY` | Jira project key | `PROJ` |
| `JIRA_TRANSITION_IN_PROGRESS` | Transition ID for "In Progress" | `21` |
| `JIRA_TRANSITION_REVIEW` | Transition ID for "Review" | `31` |
| `JIRA_TRANSITION_STAGING` | Transition ID for "Staging" | `41` |
| `JIRA_TRANSITION_PRODUCTION` | Transition ID for "Production" | `51` |

### How to find Jira Transition IDs

```bash
curl -s -u "email@example.com:YOUR_API_TOKEN" \
  "https://yourteam.atlassian.net/rest/api/3/issue/PROJ-1/transitions" \
  | jq '.transitions[] | {id, name}'
```

## Workflow Triggers

| Event | What runs | Jira transition |
|-------|-----------|-----------------|
| Push to `feature/**` or `PROJ-123` branch | `on-commit` job | Parent -> In Progress |
| PR opened/reopened to `develop` | `on-pr-review` job | Issues -> Review |
| PR merged to `develop` | `on-pr-merge` job | Subtasks -> Staging + Slack |
| Push to `master` | `deploy` job | Issues -> Production + GitHub Release + Slack |
| Manual dispatch (production) | `on-deploy-prod` job | Specified subtasks -> Production |

## Branch Naming Convention

Branch names must contain a Jira issue key for auto-detection:

- `feature/PROJ-42-add-login`
- `PROJ-42-fix-header`
- `feature/PROJ-42`

## Jira Board Statuses Required

Your Jira project must have these statuses configured:

```
To Do -> In Progress -> Review -> Staging -> Production -> Done
```

## Slack Webhooks

1. Go to [Slack API > Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Create two webhooks:
   - One for staging channel -> save as `STAGING_SLACK_WEBHOOK_URL`
   - One for releases channel -> save as `RELEASE_SLACK_WEBHOOK_URL`

## Permissions

The workflow uses `permissions: contents: write` for creating GitHub releases and tags. No additional GitHub App or PAT is needed.
