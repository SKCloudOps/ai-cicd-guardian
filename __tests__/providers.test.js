const { AIProvider, DEFAULT_MODELS, PROVIDER_ENDPOINTS } = require('../src/providers');

describe('AIProvider', () => {
  describe('constructor', () => {
    test('defaults to github-models provider', () => {
      const provider = new AIProvider({ provider: 'github-models', githubToken: 'test-token' });
      expect(provider.provider).toBe('github-models');
      expect(provider.model).toBe(DEFAULT_MODELS['github-models']);
    });

    test('accepts openai provider with api key', () => {
      const provider = new AIProvider({ provider: 'openai', openaiApiKey: 'sk-test' });
      expect(provider.provider).toBe('openai');
      expect(provider.model).toBe(DEFAULT_MODELS.openai);
    });

    test('accepts anthropic provider with api key', () => {
      const provider = new AIProvider({ provider: 'anthropic', anthropicApiKey: 'sk-ant-test' });
      expect(provider.provider).toBe('anthropic');
      expect(provider.model).toBe(DEFAULT_MODELS.anthropic);
    });

    test('allows custom model override', () => {
      const provider = new AIProvider({
        provider: 'openai',
        model: 'gpt-4o',
        openaiApiKey: 'sk-test',
      });
      expect(provider.model).toBe('gpt-4o');
    });

    test('throws on missing OpenAI API key', () => {
      expect(() => new AIProvider({ provider: 'openai' })).toThrow('OpenAI API key is required');
    });

    test('throws on missing Anthropic API key', () => {
      expect(() => new AIProvider({ provider: 'anthropic' })).toThrow(
        'Anthropic API key is required'
      );
    });

    test('throws on unsupported provider', () => {
      expect(() => new AIProvider({ provider: 'unsupported' })).toThrow('Unsupported AI provider');
    });

    test('parses maxTokens as integer', () => {
      const provider = new AIProvider({
        provider: 'github-models',
        githubToken: 'test',
        maxTokens: '2048',
      });
      expect(provider.maxTokens).toBe(2048);
    });

    test('defaults maxTokens to 4096', () => {
      const provider = new AIProvider({ provider: 'github-models', githubToken: 'test' });
      expect(provider.maxTokens).toBe(4096);
    });
  });

  describe('DEFAULT_MODELS', () => {
    test('has models for all providers', () => {
      expect(DEFAULT_MODELS['github-models']).toBeDefined();
      expect(DEFAULT_MODELS.openai).toBeDefined();
      expect(DEFAULT_MODELS.anthropic).toBeDefined();
    });
  });

  describe('PROVIDER_ENDPOINTS', () => {
    test('has endpoints for all providers', () => {
      expect(PROVIDER_ENDPOINTS['github-models']).toContain('github');
      expect(PROVIDER_ENDPOINTS.openai).toContain('openai.com');
      expect(PROVIDER_ENDPOINTS.anthropic).toContain('anthropic.com');
    });
  });
});
