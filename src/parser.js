/**
 * Output Parser
 * Extracts structured information from AI analysis responses
 */

function parseRiskLevel(analysis) {
  const riskPatterns = [
    { pattern: /\bCRITICAL\b/i, level: 'critical' },
    { pattern: /\bHIGH\b/i, level: 'high' },
    { pattern: /\bMEDIUM\b/i, level: 'medium' },
    { pattern: /\bLOW\b/i, level: 'low' },
  ];

  // Look for explicit risk level declarations
  const riskLinePattern = /risk\s*level[:\s]*(\w+)/i;
  const match = analysis.match(riskLinePattern);
  if (match) {
    const level = match[1].toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(level)) {
      return level;
    }
  }

  // Fallback: look for first occurrence of risk keywords after "Risk Level" header
  const riskSection = analysis.split(/risk\s*level/i)[1] || analysis;
  for (const { pattern, level } of riskPatterns) {
    if (riskSection.substring(0, 200).match(pattern)) {
      return level;
    }
  }

  return 'unknown';
}

function parseReviewScore(analysis) {
  // Look for patterns like "Score: 7/10", "Quality Score: 8", "Rating: 6/10"
  const patterns = [
    /(?:quality\s*)?score[:\s]*(\d+)\s*(?:\/\s*10)?/i,
    /(?:rating)[:\s]*(\d+)\s*(?:\/\s*10)?/i,
    /(\d+)\s*\/\s*10/,
  ];

  for (const pattern of patterns) {
    const match = analysis.match(pattern);
    if (match) {
      const score = parseInt(match[1]);
      if (score >= 1 && score <= 10) return score;
    }
  }

  return null;
}

function parseRootCause(analysis) {
  // Extract root cause section
  const rootCausePattern = /root\s*cause[:\s]*([\s\S]*?)(?=\n##|\n\*\*|$)/i;
  const match = analysis.match(rootCausePattern);
  if (match) {
    const cause = match[1].trim().split('\n')[0].trim();
    return cause || 'See full analysis for details';
  }
  return 'See full analysis for details';
}

function generateSummary(mode, analysis) {
  // Extract first meaningful line after any header
  const lines = analysis
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('---'));

  if (lines.length === 0) return 'Analysis complete';

  // For each mode, try to find a relevant summary
  switch (mode) {
    case 'pr-review': {
      const score = parseReviewScore(analysis);
      const summaryLine = lines[0].replace(/\*\*/g, '').substring(0, 150);
      return score ? `Score: ${score}/10 - ${summaryLine}` : summaryLine;
    }
    case 'deploy-risk': {
      const risk = parseRiskLevel(analysis);
      return `Risk: ${risk.toUpperCase()} - ${lines[0].replace(/\*\*/g, '').substring(0, 120)}`;
    }
    case 'test-analysis': {
      const rootCause = parseRootCause(analysis);
      return `Root Cause: ${rootCause.substring(0, 150)}`;
    }
    case 'release-notes':
      return `Release notes generated with ${analysis.split('\n').filter((l) => l.startsWith('-') || l.startsWith('*')).length} entries`;
    default:
      return lines[0].substring(0, 150);
  }
}

function parseOutput(mode, analysis) {
  return {
    analysis,
    summary: generateSummary(mode, analysis),
    riskLevel: mode === 'deploy-risk' ? parseRiskLevel(analysis) : undefined,
    reviewScore: mode === 'pr-review' ? parseReviewScore(analysis) : undefined,
    rootCause: mode === 'test-analysis' ? parseRootCause(analysis) : undefined,
    releaseNotes: mode === 'release-notes' ? analysis : undefined,
  };
}

module.exports = {
  parseOutput,
  parseRiskLevel,
  parseReviewScore,
  parseRootCause,
  generateSummary,
};
