const {
  parseRiskLevel,
  parseReviewScore,
  parseRootCause,
  generateSummary,
  parseOutput,
} = require('../src/parser');

describe('parseRiskLevel', () => {
  test('extracts explicit risk level declaration', () => {
    expect(parseRiskLevel('Risk Level: HIGH\nSome details')).toBe('high');
    expect(parseRiskLevel('Risk Level: CRITICAL')).toBe('critical');
    expect(parseRiskLevel('Risk level: low')).toBe('low');
    expect(parseRiskLevel('**Risk Level**: MEDIUM')).toBe('medium');
  });

  test('extracts risk from context when no explicit declaration', () => {
    expect(parseRiskLevel('The overall risk is LOW for this deployment')).toBe('low');
    expect(parseRiskLevel('Risk assessment shows CRITICAL issues')).toBe('critical');
  });

  test('returns unknown when no risk indicators found', () => {
    expect(parseRiskLevel('Everything looks fine')).toBe('unknown');
    expect(parseRiskLevel('')).toBe('unknown');
  });

  test('handles mixed case and formatting', () => {
    expect(parseRiskLevel('risk level:   High')).toBe('high');
    expect(parseRiskLevel('RISK LEVEL: medium')).toBe('medium');
  });
});

describe('parseReviewScore', () => {
  test('extracts score in various formats', () => {
    expect(parseReviewScore('Quality Score: 8/10')).toBe(8);
    expect(parseReviewScore('Score: 7')).toBe(7);
    expect(parseReviewScore('Rating: 6/10')).toBe(6);
    expect(parseReviewScore('Overall: 9/10 quality')).toBe(9);
  });

  test('returns null when no score found', () => {
    expect(parseReviewScore('Great code!')).toBeNull();
    expect(parseReviewScore('')).toBeNull();
  });

  test('ignores scores outside 1-10 range', () => {
    expect(parseReviewScore('Score: 0')).toBeNull();
    expect(parseReviewScore('Score: 11')).toBeNull();
    expect(parseReviewScore('Score: 150')).toBeNull();
  });

  test('handles edge cases', () => {
    expect(parseReviewScore('Score: 1/10 - needs work')).toBe(1);
    expect(parseReviewScore('Score: 10/10 - perfect')).toBe(10);
  });
});

describe('parseRootCause', () => {
  test('extracts root cause section', () => {
    const analysis = `## Root Cause
The test fails because the mock was not properly initialized.

## Fix Suggestions
Initialize the mock before each test.`;
    expect(parseRootCause(analysis)).toBe(
      'The test fails because the mock was not properly initialized.'
    );
  });

  test('handles inline root cause', () => {
    const analysis = 'Root cause: Missing environment variable DB_HOST';
    expect(parseRootCause(analysis)).toBe('Missing environment variable DB_HOST');
  });

  test('returns default when no root cause found', () => {
    expect(parseRootCause('Some analysis without root cause')).toBe(
      'See full analysis for details'
    );
  });
});

describe('generateSummary', () => {
  test('generates pr-review summary with score', () => {
    const analysis = 'Good code structure.\nScore: 8/10\nSome details';
    const summary = generateSummary('pr-review', analysis);
    expect(summary).toContain('Score: 8/10');
    expect(summary).toContain('Good code structure');
  });

  test('generates deploy-risk summary with risk level', () => {
    const analysis = 'Minor configuration change.\nRisk Level: LOW';
    const summary = generateSummary('deploy-risk', analysis);
    expect(summary).toContain('Risk: LOW');
  });

  test('generates test-analysis summary', () => {
    const analysis = '## Root Cause\nNull pointer in UserService.getUser()';
    const summary = generateSummary('test-analysis', analysis);
    expect(summary).toContain('Root Cause');
  });

  test('generates release-notes summary', () => {
    const analysis = '# Release Notes\n- Added auth\n- Fixed bug\n- Updated deps';
    const summary = generateSummary('release-notes', analysis);
    expect(summary).toContain('3 entries');
  });

  test('handles empty analysis', () => {
    expect(generateSummary('pr-review', '')).toBe('Analysis complete');
  });
});

describe('parseOutput', () => {
  test('returns complete output structure for pr-review', () => {
    const result = parseOutput('pr-review', 'Good code. Score: 7/10');
    expect(result.analysis).toBe('Good code. Score: 7/10');
    expect(result.reviewScore).toBe(7);
    expect(result.summary).toBeDefined();
    expect(result.riskLevel).toBeUndefined();
  });

  test('returns complete output structure for deploy-risk', () => {
    const result = parseOutput('deploy-risk', 'Risk Level: HIGH\nDatabase migration detected');
    expect(result.riskLevel).toBe('high');
    expect(result.reviewScore).toBeUndefined();
  });

  test('returns complete output structure for test-analysis', () => {
    const result = parseOutput(
      'test-analysis',
      'Root Cause: Timeout in API call\n## Fix\nIncrease timeout'
    );
    expect(result.rootCause).toBe('Timeout in API call');
  });

  test('returns release notes for release-notes mode', () => {
    const notes = '## Features\n- Added login\n## Fixes\n- Fixed crash';
    const result = parseOutput('release-notes', notes);
    expect(result.releaseNotes).toBe(notes);
  });
});
