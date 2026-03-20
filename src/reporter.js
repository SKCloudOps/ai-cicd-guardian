/**
 * Reporter
 * Handles posting results as PR comments, writing output files, and formatting
 */

const github = require('@actions/github');
const core = require('@actions/core');
const fs = require('fs');

const COMMENT_MARKER = '<!-- ai-cicd-guardian-bot -->';

function formatPRComment(mode, result) {
  const modeLabels = {
    'pr-review': 'Code Review',
    'release-notes': 'Release Notes',
    'test-analysis': 'Test Failure Analysis',
    'deploy-risk': 'Deployment Risk Assessment',
  };

  const modeEmojis = {
    'pr-review': '🔍',
    'release-notes': '📋',
    'test-analysis': '🧪',
    'deploy-risk': '🚀',
  };

  const riskBadges = {
    low: '🟢 LOW',
    medium: '🟡 MEDIUM',
    high: '🟠 HIGH',
    critical: '🔴 CRITICAL',
  };

  let header = `${COMMENT_MARKER}\n## ${modeEmojis[mode] || '🤖'} AI CI/CD Guardian - ${modeLabels[mode] || mode}\n\n`;

  if (result.riskLevel) {
    header += `**Risk Level**: ${riskBadges[result.riskLevel] || result.riskLevel}\n\n`;
  }
  if (result.reviewScore) {
    header += `**Quality Score**: ${'⭐'.repeat(Math.min(result.reviewScore, 10))} (${result.reviewScore}/10)\n\n`;
  }

  const footer = `\n\n---\n*Powered by [AI CI/CD Guardian](https://github.com/SKCloudOps/ai-cicd-guardian) | ${new Date().toISOString()}*`;

  return header + result.analysis + footer;
}

async function postPRComment(token, result, mode) {
  const { context } = github;
  const pr = context.payload.pull_request;

  if (!pr) {
    core.warning('No pull request context found, skipping PR comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const body = formatPRComment(mode, result);

  // Check for existing bot comment to update
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pr.number,
  });

  const existingComment = comments.find(
    (c) => c.body && c.body.includes(COMMENT_MARKER) && c.body.includes(mode)
  );

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: existingComment.id,
      body,
    });
    core.info(`Updated existing PR comment #${existingComment.id}`);
  } else {
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pr.number,
      body,
    });
    core.info('Posted new PR comment');
  }
}

function writeOutputFile(filePath, result) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const output = {
    timestamp: new Date().toISOString(),
    summary: result.summary,
    riskLevel: result.riskLevel,
    reviewScore: result.reviewScore,
    rootCause: result.rootCause,
    analysis: result.analysis,
  };

  if (filePath.endsWith('.json')) {
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  } else {
    fs.writeFileSync(filePath, result.analysis);
  }

  core.info(`Analysis written to ${filePath}`);
}

function setOutputs(result) {
  core.setOutput('analysis', result.analysis);
  core.setOutput('summary', result.summary);

  if (result.riskLevel) core.setOutput('risk_level', result.riskLevel);
  if (result.reviewScore) core.setOutput('review_score', result.reviewScore.toString());
  if (result.rootCause) core.setOutput('failure_root_cause', result.rootCause);
  if (result.releaseNotes) core.setOutput('release_notes', result.releaseNotes);
}

module.exports = {
  postPRComment,
  writeOutputFile,
  setOutputs,
  formatPRComment,
  COMMENT_MARKER,
};
