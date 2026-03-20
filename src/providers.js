/**
 * AI Provider Abstraction Layer
 * Supports: GitHub Models, OpenAI, Anthropic Claude
 */

const DEFAULT_MODELS = {
  'github-models': 'openai/gpt-4o-mini',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
};

const PROVIDER_ENDPOINTS = {
  'github-models': 'https://models.github.ai/inference/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

class AIProvider {
  constructor(config) {
    this.provider = config.provider || 'github-models';
    this.model = config.model || DEFAULT_MODELS[this.provider];
    this.maxTokens = parseInt(config.maxTokens) || 4096;
    this.apiKey = this._resolveApiKey(config);
    this.verbose = config.verbose || false;
  }

  _resolveApiKey(config) {
    switch (this.provider) {
      case 'github-models':
        return config.githubToken;
      case 'openai':
        if (!config.openaiApiKey) throw new Error('OpenAI API key is required when using openai provider');
        return config.openaiApiKey;
      case 'anthropic':
        if (!config.anthropicApiKey) throw new Error('Anthropic API key is required when using anthropic provider');
        return config.anthropicApiKey;
      default:
        throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  async analyze(systemPrompt, userPrompt) {
    if (this.verbose) {
      console.log(`[AI Provider] Using ${this.provider} with model ${this.model}`);
      console.log(`[AI Provider] System prompt length: ${systemPrompt.length}`);
      console.log(`[AI Provider] User prompt length: ${userPrompt.length}`);
    }

    if (this.provider === 'anthropic') {
      return this._callAnthropic(systemPrompt, userPrompt);
    }
    return this._callOpenAICompatible(systemPrompt, userPrompt);
  }

  async _callOpenAICompatible(systemPrompt, userPrompt) {
    const endpoint = PROVIDER_ENDPOINTS[this.provider];
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`${this.provider} API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async _callAnthropic(systemPrompt, userPrompt) {
    const endpoint = PROVIDER_ENDPOINTS.anthropic;
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };

    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return data.content.map((block) => block.text).join('\n');
  }
}

module.exports = { AIProvider, DEFAULT_MODELS, PROVIDER_ENDPOINTS };
