/**
 * Prompt Templates for each AI analysis mode
 */

const SYSTEM_PROMPTS = {
  'pr-review': `You are an expert code reviewer specializing in CI/CD best practices, security, and code quality.
You analyze pull request diffs and provide structured, actionable feedback.

Your review MUST include:
1. **Summary**: Brief overview of changes
2. **Quality Score**: Rate 1-10 with justification
3. **Issues Found**: Categorized as critical/warning/info
4. **Security Concerns**: Any security implications
5. **Suggestions**: Specific improvement recommendations
6. **CI/CD Impact**: How changes affect build/deploy pipelines

Format your response in Markdown. Be constructive and specific.`,

  'release-notes': `You are a technical writer who generates clear, user-friendly release notes from git commit history and diffs.

Your release notes MUST:
1. Group changes by category: Features, Bug Fixes, Performance, Security, Breaking Changes, Dependencies, Documentation
2. Write each entry in past tense, user-facing language
3. Include contributor attribution when available
4. Highlight breaking changes prominently
5. Add migration notes for breaking changes

Format: Use Markdown with clear headers and bullet points.`,

  'test-analysis': `You are a senior QA engineer who analyzes test failures to identify root causes and suggest fixes.

Your analysis MUST include:
1. **Root Cause**: Primary reason for failure
2. **Failure Category**: Build error | Test logic | Environment | Flaky | Dependency | Timeout | Configuration
3. **Affected Components**: Which parts of the codebase are impacted
4. **Fix Suggestions**: Specific, actionable steps to resolve
5. **Prevention**: How to prevent similar failures
6. **Confidence**: Your confidence level in the root cause (high/medium/low)

Be precise. Reference specific line numbers, error messages, and stack traces.`,

  'deploy-risk': `You are a DevOps/SRE expert who assesses deployment risk by analyzing code changes, configurations, and infrastructure manifests.

Your assessment MUST include:
1. **Risk Level**: LOW | MEDIUM | HIGH | CRITICAL
2. **Risk Score**: Numeric score 1-100
3. **Risk Factors**: Itemized list with severity
4. **Blast Radius**: What could be affected if deployment fails
5. **Rollback Complexity**: How easy is it to rollback (simple/moderate/complex)
6. **Recommendations**: Deploy/hold/review decisions with reasoning
7. **Checklist**: Pre-deployment verification steps

Categories to evaluate:
- Database migrations
- API contract changes
- Infrastructure changes
- Configuration changes
- Dependency updates
- Service mesh / networking changes
- Secret/credential changes`,
};

function buildUserPrompt(mode, context) {
  const parts = [];

  switch (mode) {
    case 'pr-review':
      parts.push('## Pull Request Details');
      parts.push(`**Title**: ${context.prTitle || 'N/A'}`);
      parts.push(`**Author**: ${context.prAuthor || 'N/A'}`);
      parts.push(`**Base Branch**: ${context.baseBranch || 'N/A'}`);
      parts.push(`**Head Branch**: ${context.headBranch || 'N/A'}`);
      parts.push(`**Files Changed**: ${context.filesChanged || 'N/A'}`);
      if (context.prBody) {
        parts.push(`\n**Description**:\n${context.prBody}`);
      }
      parts.push(`\n## Diff\n\`\`\`diff\n${context.diff || 'No diff available'}\n\`\`\``);
      if (context.reviewLevel) {
        parts.push(`\n**Review Depth**: ${context.reviewLevel}`);
      }
      break;

    case 'release-notes':
      parts.push('## Commit History');
      parts.push(`**From Tag**: ${context.fromTag || 'N/A'}`);
      parts.push(`**To Tag/Ref**: ${context.toRef || 'HEAD'}`);
      parts.push(`**Format**: ${context.format || 'markdown'}`);
      parts.push(`\n## Commits\n${context.commits || 'No commits found'}`);
      if (context.diff) {
        parts.push(`\n## Changes Summary\n\`\`\`diff\n${context.diff}\n\`\`\``);
      }
      break;

    case 'test-analysis':
      parts.push('## Test Failure Report');
      parts.push(`**Framework**: ${context.testFramework || 'auto-detect'}`);
      parts.push(`**Exit Code**: ${context.exitCode || 'N/A'}`);
      parts.push(`\n## Test Output\n\`\`\`\n${context.testLog || 'No test log available'}\n\`\`\``);
      if (context.diff) {
        parts.push(`\n## Recent Changes\n\`\`\`diff\n${context.diff}\n\`\`\``);
      }
      break;

    case 'deploy-risk':
      parts.push('## Deployment Assessment Request');
      parts.push(`**Environment**: ${context.environment || 'production'}`);
      parts.push(`**Files Changed**: ${context.filesChanged || 'N/A'}`);
      parts.push(`\n## Code Changes\n\`\`\`diff\n${context.diff || 'No diff available'}\n\`\`\``);
      if (context.manifest) {
        parts.push(`\n## Deployment Manifest\n\`\`\`yaml\n${context.manifest}\n\`\`\``);
      }
      if (context.commitMessages) {
        parts.push(`\n## Commit Messages\n${context.commitMessages}`);
      }
      break;
  }

  if (context.customPrompt) {
    parts.push(`\n## Additional Instructions\n${context.customPrompt}`);
  }

  return parts.join('\n');
}

function getSystemPrompt(mode) {
  return SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS['pr-review'];
}

module.exports = { getSystemPrompt, buildUserPrompt, SYSTEM_PROMPTS };
