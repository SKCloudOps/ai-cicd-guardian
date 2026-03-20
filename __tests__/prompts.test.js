const { getSystemPrompt, buildUserPrompt, SYSTEM_PROMPTS } = require('../src/prompts');

describe('getSystemPrompt', () => {
  test('returns correct prompt for each mode', () => {
    expect(getSystemPrompt('pr-review')).toContain('code reviewer');
    expect(getSystemPrompt('release-notes')).toContain('release notes');
    expect(getSystemPrompt('test-analysis')).toContain('test failures');
    expect(getSystemPrompt('deploy-risk')).toContain('deployment risk');
  });

  test('falls back to pr-review for unknown mode', () => {
    expect(getSystemPrompt('unknown')).toBe(SYSTEM_PROMPTS['pr-review']);
  });
});

describe('buildUserPrompt', () => {
  test('builds pr-review prompt with all fields', () => {
    const context = {
      prTitle: 'Add auth feature',
      prAuthor: 'dev123',
      baseBranch: 'main',
      headBranch: 'feature/auth',
      filesChanged: 'M: src/auth.js (+50 -10)',
      prBody: 'Implements JWT auth',
      diff: '+ const jwt = require("jsonwebtoken");',
      reviewLevel: 'thorough',
    };
    const prompt = buildUserPrompt('pr-review', context);
    expect(prompt).toContain('Add auth feature');
    expect(prompt).toContain('dev123');
    expect(prompt).toContain('main');
    expect(prompt).toContain('feature/auth');
    expect(prompt).toContain('thorough');
    expect(prompt).toContain('jwt');
  });

  test('builds release-notes prompt', () => {
    const context = {
      fromTag: 'v1.0.0',
      toRef: 'HEAD',
      format: 'markdown',
      commits: 'abc123|dev|feat: add login|2024-01-01',
    };
    const prompt = buildUserPrompt('release-notes', context);
    expect(prompt).toContain('v1.0.0');
    expect(prompt).toContain('HEAD');
    expect(prompt).toContain('add login');
  });

  test('builds test-analysis prompt', () => {
    const context = {
      testFramework: 'jest',
      exitCode: '1',
      testLog: 'FAIL src/auth.test.js\nTypeError: Cannot read property',
    };
    const prompt = buildUserPrompt('test-analysis', context);
    expect(prompt).toContain('jest');
    expect(prompt).toContain('FAIL');
    expect(prompt).toContain('TypeError');
  });

  test('builds deploy-risk prompt', () => {
    const context = {
      environment: 'production',
      diff: '+ replicas: 5',
      filesChanged: 'M: k8s/deployment.yaml',
      commitMessages: '- scale up replicas',
      manifest: 'apiVersion: apps/v1\nkind: Deployment',
    };
    const prompt = buildUserPrompt('deploy-risk', context);
    expect(prompt).toContain('production');
    expect(prompt).toContain('replicas');
    expect(prompt).toContain('Deployment');
  });

  test('appends custom prompt when provided', () => {
    const context = { customPrompt: 'Focus on security only', diff: 'some diff' };
    const prompt = buildUserPrompt('pr-review', context);
    expect(prompt).toContain('Focus on security only');
    expect(prompt).toContain('Additional Instructions');
  });

  test('handles missing optional fields gracefully', () => {
    const context = {};
    const prompt = buildUserPrompt('pr-review', context);
    expect(prompt).toContain('N/A');
    expect(prompt).toContain('No diff available');
  });
});
