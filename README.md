# 🛡️ AI CI/CD Guardian

[![CI](https://github.com/SKCloudOps/ai-cicd-guardian/actions/workflows/ci.yml/badge.svg)](https://github.com/SKCloudOps/ai-cicd-guardian/actions/workflows/ci.yml)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-AI%20CI%2FCD%20Guardian-blue?logo=github)](https://github.com/marketplace/actions/ai-ci-cd-guardian)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AI-powered CI/CD pipeline analysis** — code review, release notes, test failure analysis, and deployment risk assessment. Supports GitHub Models (free), OpenAI, and Anthropic Claude.

---

## Features

| Mode | Trigger | What It Does |
|------|---------|--------------|
| `pr-review` | Pull Request | AI code review with quality scoring, security analysis, and actionable feedback |
| `release-notes` | Tag Push | Generates categorized, user-friendly release notes from commit history |
| `test-analysis` | Test Failure | Root cause analysis of test failures with fix suggestions |
| `deploy-risk` | Pre-Deploy | Risk assessment with blast radius analysis and rollback complexity rating |
| `full` | Any | Runs all applicable modes based on the event context |

## Quick Start

### 1. AI PR Code Review

```yaml
name: AI PR Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: SKCloudOps/ai-cicd-guardian@v1
        with:
          mode: 'pr-review'
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. AI Release Notes

```yaml
name: Release Notes
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - id: notes
        uses: SKCloudOps/ai-cicd-guardian@v1
        with:
          mode: 'release-notes'
          github_token: ${{ secrets.GITHUB_TOKEN }}

      - uses: softprops/action-gh-release@v1
        with:
          body: ${{ steps.notes.outputs.release_notes }}
```

### 3. AI Test Failure Analysis

```yaml
- name: Run Tests
  id: tests
  continue-on-error: true
  run: npm test 2>&1 | tee test-output.log

- name: AI Test Analysis
  if: steps.tests.outcome == 'failure'
  uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'test-analysis'
    github_token: ${{ secrets.GITHUB_TOKEN }}
    test_log_path: 'test-output.log'
```

### 4. Deployment Risk Assessment

```yaml
- name: Risk Check
  id: risk
  uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'deploy-risk'
    github_token: ${{ secrets.GITHUB_TOKEN }}
    deploy_environment: 'production'
    fail_on_risk: 'true'
```

## AI Providers

| Provider | Setup | Cost | Best For |
|----------|-------|------|----------|
| `github-models` (default) | No extra setup needed | Free tier available | Getting started, open source projects |
| `openai` | Add `OPENAI_API_KEY` secret | Pay per token | High-volume, GPT-4o access |
| `anthropic` | Add `ANTHROPIC_API_KEY` secret | Pay per token | Claude analysis, detailed reviews |

### Using OpenAI

```yaml
- uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'pr-review'
    ai_provider: 'openai'
    ai_model: 'gpt-4o'
    github_token: ${{ secrets.GITHUB_TOKEN }}
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

### Using Anthropic Claude

```yaml
- uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'pr-review'
    ai_provider: 'anthropic'
    ai_model: 'claude-sonnet-4-20250514'
    github_token: ${{ secrets.GITHUB_TOKEN }}
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `mode` | Yes | `full` | `pr-review`, `release-notes`, `test-analysis`, `deploy-risk`, `full` |
| `ai_provider` | No | `github-models` | `github-models`, `openai`, `anthropic` |
| `ai_model` | No | Auto-selected | Override model name |
| `github_token` | Yes | `${{ github.token }}` | GitHub token |
| `openai_api_key` | No | — | Required for `openai` provider |
| `anthropic_api_key` | No | — | Required for `anthropic` provider |
| `review_level` | No | `standard` | `quick`, `standard`, `thorough` |
| `release_tag` | No | Auto-detected | Starting tag for release notes |
| `release_format` | No | `markdown` | `markdown`, `json`, `conventional` |
| `test_log_path` | No | — | Path to test output log |
| `test_framework` | No | `auto` | `jest`, `pytest`, `go-test`, `junit`, `mocha`, `auto` |
| `deploy_environment` | No | `production` | `dev`, `staging`, `production` |
| `deploy_manifest_path` | No | Auto-detected | Path to k8s/docker/terraform manifests |
| `max_tokens` | No | `4096` | Max AI response tokens |
| `custom_prompt` | No | — | Additional instructions for the AI |
| `output_file` | No | — | Write analysis to file (`.json` or `.md`) |
| `fail_on_risk` | No | `false` | Fail workflow on HIGH/CRITICAL risk |
| `post_review_comment` | No | `true` | Post review as PR comment |
| `verbose` | No | `false` | Enable detailed logging |

## Outputs

| Output | Mode | Description |
|--------|------|-------------|
| `analysis` | All | Full AI analysis text |
| `summary` | All | One-line summary |
| `risk_level` | `deploy-risk` | `low`, `medium`, `high`, `critical` |
| `review_score` | `pr-review` | Quality score 1–10 |
| `release_notes` | `release-notes` | Generated release notes |
| `failure_root_cause` | `test-analysis` | Root cause description |

### Using Outputs in Subsequent Steps

```yaml
- name: AI Analysis
  id: guardian
  uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'deploy-risk'
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Gate Deployment
  if: steps.guardian.outputs.risk_level == 'critical'
  run: |
    echo "🚫 Deployment blocked: ${{ steps.guardian.outputs.summary }}"
    exit 1
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  AI CI/CD Guardian                    │
├──────────┬──────────┬──────────────┬────────────────┤
│ PR Review│ Release  │ Test Analysis │ Deploy Risk    │
│          │ Notes    │              │ Assessment     │
├──────────┴──────────┴──────────────┴────────────────┤
│              Context Gatherer                        │
│  (Git diffs, PR data, test logs, manifests)          │
├─────────────────────────────────────────────────────┤
│              AI Provider Layer                        │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐       │
│  │ GitHub   │ │ OpenAI   │ │  Anthropic    │       │
│  │ Models   │ │          │ │  Claude       │       │
│  └──────────┘ └──────────┘ └───────────────┘       │
├─────────────────────────────────────────────────────┤
│              Output Parser & Reporter                │
│  (PR comments, risk levels, scores, files)           │
└─────────────────────────────────────────────────────┘
```

## Advanced Usage

### Custom AI Instructions

```yaml
- uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'pr-review'
    github_token: ${{ secrets.GITHUB_TOKEN }}
    custom_prompt: |
      Focus specifically on:
      - HIPAA compliance for healthcare data
      - SQL injection vulnerabilities
      - Kubernetes security best practices
```

### Save Analysis to File

```yaml
- uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'deploy-risk'
    github_token: ${{ secrets.GITHUB_TOKEN }}
    output_file: 'reports/risk-analysis.json'

- uses: actions/upload-artifact@v4
  with:
    name: risk-report
    path: reports/risk-analysis.json
```

### Full Mode (All Analyses)

```yaml
- uses: SKCloudOps/ai-cicd-guardian@v1
  with:
    mode: 'full'
    github_token: ${{ secrets.GITHUB_TOKEN }}
    deploy_environment: 'production'
    fail_on_risk: 'true'
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for distribution
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ by [SKCloudOps](https://github.com/SKCloudOps)
