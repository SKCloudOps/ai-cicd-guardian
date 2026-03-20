/**
 * AI CI/CD Guardian - Main Entry Point
 *
 * Orchestrates AI-powered analysis for CI/CD pipelines:
 * - PR Code Review
 * - Release Notes Generation
 * - Test Failure Analysis
 * - Deployment Risk Assessment
 */

const core = require('@actions/core');
const { AIProvider } = require('./providers');
const { getSystemPrompt, buildUserPrompt } = require('./prompts');
const { gatherContext } = require('./context');
const { parseOutput } = require('./parser');
const { postPRComment, writeOutputFile, setOutputs } = require('./reporter');

const VALID_MODES = ['pr-review', 'release-notes', 'test-analysis', 'deploy-risk', 'full'];

function getInputs() {
  return {
    mode: core.getInput('mode') || 'full',
    ai_provider: core.getInput('ai_provider') || 'github-models',
    ai_model: core.getInput('ai_model') || '',
    github_token: core.getInput('github_token', { required: true }),
    openai_api_key: core.getInput('openai_api_key') || '',
    anthropic_api_key: core.getInput('anthropic_api_key') || '',
    review_level: core.getInput('review_level') || 'standard',
    release_tag: core.getInput('release_tag') || '',
    release_format: core.getInput('release_format') || 'markdown',
    test_log_path: core.getInput('test_log_path') || '',
    test_framework: core.getInput('test_framework') || 'auto',
    deploy_environment: core.getInput('deploy_environment') || 'production',
    deploy_manifest_path: core.getInput('deploy_manifest_path') || '',
    max_tokens: core.getInput('max_tokens') || '4096',
    custom_prompt: core.getInput('custom_prompt') || '',
    output_file: core.getInput('output_file') || '',
    fail_on_risk: core.getInput('fail_on_risk') === 'true',
    post_review_comment: core.getInput('post_review_comment') !== 'false',
    verbose: core.getInput('verbose') === 'true',
  };
}

async function runMode(mode, inputs, aiProvider) {
  core.info(`\n${'='.repeat(60)}`);
  core.info(`Running mode: ${mode}`);
  core.info(`${'='.repeat(60)}`);

  // 1. Gather context
  core.info(`Gathering context for ${mode}...`);
  const context = await gatherContext(mode, inputs);

  // 2. Build prompts
  const systemPrompt = getSystemPrompt(mode);
  const userPrompt = buildUserPrompt(mode, context);

  if (inputs.verbose) {
    core.info(`System prompt: ${systemPrompt.substring(0, 200)}...`);
    core.info(`User prompt length: ${userPrompt.length} chars`);
  }

  // 3. Call AI
  core.info(`Calling ${inputs.ai_provider} for analysis...`);
  const startTime = Date.now();
  const analysis = await aiProvider.analyze(systemPrompt, userPrompt);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  core.info(`AI analysis completed in ${elapsed}s`);

  // 4. Parse output
  const result = parseOutput(mode, analysis);
  core.info(`Summary: ${result.summary}`);

  return result;
}

async function run() {
  try {
    const inputs = getInputs();
    const mode = inputs.mode.toLowerCase();

    // Validate mode
    if (!VALID_MODES.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Valid modes: ${VALID_MODES.join(', ')}`);
    }

    // Initialize AI provider
    const aiProvider = new AIProvider({
      provider: inputs.ai_provider,
      model: inputs.ai_model,
      maxTokens: inputs.max_tokens,
      githubToken: inputs.github_token,
      openaiApiKey: inputs.openai_api_key,
      anthropicApiKey: inputs.anthropic_api_key,
      verbose: inputs.verbose,
    });

    core.info(`AI CI/CD Guardian v1.0.0`);
    core.info(`Provider: ${inputs.ai_provider} | Mode: ${mode}`);

    let results;

    if (mode === 'full') {
      // Run all applicable modes
      results = {};
      const applicableModes = determineApplicableModes();
      core.info(`Full mode - running: ${applicableModes.join(', ')}`);

      for (const m of applicableModes) {
        try {
          results[m] = await runMode(m, inputs, aiProvider);
        } catch (err) {
          core.warning(`Mode ${m} failed: ${err.message}`);
          results[m] = { analysis: `Error: ${err.message}`, summary: `Failed: ${err.message}` };
        }
      }

      // Combine results for outputs
      const combinedAnalysis = Object.entries(results)
        .map(([m, r]) => `# ${m.toUpperCase()}\n\n${r.analysis}`)
        .join('\n\n---\n\n');

      const primaryResult = {
        analysis: combinedAnalysis,
        summary: Object.values(results).map((r) => r.summary).join(' | '),
        riskLevel: results['deploy-risk']?.riskLevel,
        reviewScore: results['pr-review']?.reviewScore,
        rootCause: results['test-analysis']?.rootCause,
        releaseNotes: results['release-notes']?.releaseNotes,
      };

      setOutputs(primaryResult);

      // Post PR comment if applicable
      if (inputs.post_review_comment && results['pr-review']) {
        await postPRComment(inputs.github_token, results['pr-review'], 'pr-review');
      }

      // Write output file
      if (inputs.output_file) {
        writeOutputFile(inputs.output_file, primaryResult);
      }

      // Fail on risk
      if (inputs.fail_on_risk && results['deploy-risk']?.riskLevel) {
        checkRiskFailure(results['deploy-risk'].riskLevel);
      }
    } else {
      // Single mode
      const result = await runMode(mode, inputs, aiProvider);
      setOutputs(result);

      // Post PR comment
      if (inputs.post_review_comment && mode === 'pr-review') {
        await postPRComment(inputs.github_token, result, mode);
      }

      // Write output file
      if (inputs.output_file) {
        writeOutputFile(inputs.output_file, result);
      }

      // Fail on risk
      if (inputs.fail_on_risk && mode === 'deploy-risk' && result.riskLevel) {
        checkRiskFailure(result.riskLevel);
      }
    }

    core.info('\n✅ AI CI/CD Guardian analysis complete!');
  } catch (error) {
    core.setFailed(`AI CI/CD Guardian failed: ${error.message}`);
    if (error.stack) core.debug(error.stack);
  }
}

function determineApplicableModes() {
  const { context } = require('@actions/github');
  const modes = [];

  // PR events get code review
  if (context.payload.pull_request) {
    modes.push('pr-review');
  }

  // Always try deploy risk and release notes
  modes.push('deploy-risk');
  modes.push('release-notes');

  return modes;
}

function checkRiskFailure(riskLevel) {
  if (riskLevel === 'high' || riskLevel === 'critical') {
    core.setFailed(
      `Deployment risk is ${riskLevel.toUpperCase()}. Set fail_on_risk: false to override.`
    );
  }
}

// Export for testing
module.exports = { run, getInputs, determineApplicableModes, checkRiskFailure };

// Run if executed directly
if (require.main === module) {
  run();
}
