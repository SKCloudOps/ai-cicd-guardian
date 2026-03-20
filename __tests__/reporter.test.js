const { formatPRComment, COMMENT_MARKER } = require('../src/reporter');

describe('formatPRComment', () => {
  test('includes bot marker for updates', () => {
    const result = { analysis: 'Test analysis', summary: 'Summary' };
    const comment = formatPRComment('pr-review', result);
    expect(comment).toContain(COMMENT_MARKER);
  });

  test('includes mode-specific header', () => {
    const result = { analysis: 'Analysis', summary: 'Summary' };
    expect(formatPRComment('pr-review', result)).toContain('Code Review');
    expect(formatPRComment('release-notes', result)).toContain('Release Notes');
    expect(formatPRComment('test-analysis', result)).toContain('Test Failure Analysis');
    expect(formatPRComment('deploy-risk', result)).toContain('Deployment Risk Assessment');
  });

  test('includes risk badge for deploy-risk', () => {
    const result = { analysis: 'Analysis', riskLevel: 'high' };
    const comment = formatPRComment('deploy-risk', result);
    expect(comment).toContain('HIGH');
    expect(comment).toContain('🟠');
  });

  test('includes quality score stars for pr-review', () => {
    const result = { analysis: 'Analysis', reviewScore: 8 };
    const comment = formatPRComment('pr-review', result);
    expect(comment).toContain('⭐');
    expect(comment).toContain('8/10');
  });

  test('includes footer with branding', () => {
    const result = { analysis: 'Analysis' };
    const comment = formatPRComment('pr-review', result);
    expect(comment).toContain('AI CI/CD Guardian');
    expect(comment).toContain('SKCloudOps');
  });

  test('includes analysis content', () => {
    const result = { analysis: 'The code looks great with minor issues.' };
    const comment = formatPRComment('pr-review', result);
    expect(comment).toContain('The code looks great with minor issues.');
  });
});
