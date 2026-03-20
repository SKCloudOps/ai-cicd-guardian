/**
 * Context Gatherer
 * Collects relevant data for each analysis mode from the GitHub event and repo.
 */

const github = require('@actions/github');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');

const MAX_DIFF_LENGTH = 60000; // ~15k tokens

async function execCommand(command, args = []) {
  let output = '';
  let errorOutput = '';
  const options = {
    listeners: {
      stdout: (data) => { output += data.toString(); },
      stderr: (data) => { errorOutput += data.toString(); },
    },
    silent: true,
    ignoreReturnCode: true,
  };
  const exitCode = await exec.exec(command, args, options);
  return { output: output.trim(), errorOutput: errorOutput.trim(), exitCode };
}

function truncateDiff(diff) {
  if (diff.length <= MAX_DIFF_LENGTH) return diff;
  const half = Math.floor(MAX_DIFF_LENGTH / 2);
  return (
    diff.substring(0, half) +
    '\n\n... [TRUNCATED - diff too large, showing first and last portions] ...\n\n' +
    diff.substring(diff.length - half)
  );
}

async function gatherPRContext(inputs) {
  const { context } = github;
  const octokit = github.getOctokit(inputs.github_token);
  const pr = context.payload.pull_request;

  if (!pr) {
    throw new Error('pr-review mode requires a pull_request event trigger');
  }

  // Fetch PR diff
  const { data: diff } = await octokit.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
    mediaType: { format: 'diff' },
  });

  // Fetch changed files
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pr.number,
  });

  const fileNames = files.map((f) => `${f.status}: ${f.filename} (+${f.additions} -${f.deletions})`).join('\n');

  return {
    prTitle: pr.title,
    prAuthor: pr.user.login,
    prBody: pr.body || '',
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    prNumber: pr.number,
    filesChanged: fileNames,
    diff: truncateDiff(typeof diff === 'string' ? diff : JSON.stringify(diff)),
    reviewLevel: inputs.review_level,
    customPrompt: inputs.custom_prompt,
  };
}

async function gatherReleaseContext(inputs) {
  let fromTag = inputs.release_tag;

  if (!fromTag) {
    // Get the two most recent tags
    const { output: tags } = await execCommand('git', [
      'tag',
      '--sort=-creatordate',
      '--format=%(refname:short)',
    ]);
    const tagList = tags.split('\n').filter(Boolean);
    if (tagList.length >= 2) {
      fromTag = tagList[1]; // Previous tag
    } else if (tagList.length === 1) {
      // Only one tag, get all commits
      fromTag = '';
    }
  }

  // Get commit log
  const range = fromTag ? `${fromTag}..HEAD` : 'HEAD';
  const { output: commits } = await execCommand('git', [
    'log',
    range,
    '--pretty=format:%h|%an|%s|%ai',
    '--no-merges',
  ]);

  // Get diff stat
  let diff = '';
  if (fromTag) {
    const { output: diffOutput } = await execCommand('git', ['diff', '--stat', fromTag, 'HEAD']);
    diff = diffOutput;
  }

  return {
    fromTag: fromTag || 'initial',
    toRef: 'HEAD',
    format: inputs.release_format,
    commits: commits || 'No commits found',
    diff: truncateDiff(diff),
    customPrompt: inputs.custom_prompt,
  };
}

async function gatherTestContext(inputs) {
  let testLog = '';

  // Read test log from file if provided
  if (inputs.test_log_path && fs.existsSync(inputs.test_log_path)) {
    testLog = fs.readFileSync(inputs.test_log_path, 'utf-8');
  }

  // If no log file, try to capture from recent git changes
  let diff = '';
  const { output: diffOutput } = await execCommand('git', [
    'diff',
    'HEAD~1',
    '--',
    '*.test.*',
    '*.spec.*',
    '*_test.*',
    'test/',
    'tests/',
    '__tests__/',
  ]);
  diff = diffOutput;

  // Detect test framework from package.json or config files
  let testFramework = inputs.test_framework;
  if (testFramework === 'auto') {
    testFramework = detectTestFramework();
  }

  return {
    testLog: testLog.substring(0, MAX_DIFF_LENGTH) || 'No test log provided. Analyzing test file changes only.',
    testFramework,
    diff: truncateDiff(diff),
    exitCode: process.env.TEST_EXIT_CODE || 'N/A',
    customPrompt: inputs.custom_prompt,
  };
}

function detectTestFramework() {
  const checks = [
    { file: 'jest.config.js', name: 'jest' },
    { file: 'jest.config.ts', name: 'jest' },
    { file: 'pytest.ini', name: 'pytest' },
    { file: 'pyproject.toml', name: 'pytest' },
    { file: '.mocharc.yml', name: 'mocha' },
    { file: 'go.mod', name: 'go-test' },
  ];

  for (const check of checks) {
    if (fs.existsSync(check.file)) return check.name;
  }

  // Check package.json for test runner hints
  if (fs.existsSync('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const testScript = pkg.scripts?.test || '';
      if (testScript.includes('jest')) return 'jest';
      if (testScript.includes('mocha')) return 'mocha';
      if (testScript.includes('vitest')) return 'vitest';
    } catch (e) {
      // ignore parse errors
    }
  }

  return 'unknown';
}

async function gatherDeployContext(inputs) {
  const { context } = github;

  // Get recent changes
  const { output: diff } = await execCommand('git', ['diff', 'HEAD~5..HEAD']);

  // Get commit messages
  const { output: commitMessages } = await execCommand('git', [
    'log',
    'HEAD~5..HEAD',
    '--pretty=format:- %s (%an)',
  ]);

  // Get changed files
  const { output: filesChanged } = await execCommand('git', [
    'diff',
    '--name-status',
    'HEAD~5..HEAD',
  ]);

  // Read deployment manifest if provided
  let manifest = '';
  if (inputs.deploy_manifest_path && fs.existsSync(inputs.deploy_manifest_path)) {
    manifest = fs.readFileSync(inputs.deploy_manifest_path, 'utf-8');
  } else {
    // Auto-detect common manifests
    const manifestPaths = [
      'kubernetes/',
      'k8s/',
      'deploy/',
      'docker-compose.yml',
      'docker-compose.yaml',
      'Dockerfile',
      'helm/',
      'terraform/',
      'infra/',
    ];
    for (const mp of manifestPaths) {
      if (fs.existsSync(mp)) {
        const { output: manifestDiff } = await execCommand('git', [
          'diff',
          'HEAD~5..HEAD',
          '--',
          mp,
        ]);
        if (manifestDiff) {
          manifest += `\n--- ${mp} ---\n${manifestDiff}`;
        }
      }
    }
  }

  return {
    environment: inputs.deploy_environment,
    diff: truncateDiff(diff),
    filesChanged,
    commitMessages,
    manifest: manifest.substring(0, 30000) || 'No deployment manifests detected',
    customPrompt: inputs.custom_prompt,
  };
}

async function gatherContext(mode, inputs) {
  switch (mode) {
    case 'pr-review':
      return gatherPRContext(inputs);
    case 'release-notes':
      return gatherReleaseContext(inputs);
    case 'test-analysis':
      return gatherTestContext(inputs);
    case 'deploy-risk':
      return gatherDeployContext(inputs);
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

module.exports = { gatherContext, detectTestFramework, truncateDiff };
