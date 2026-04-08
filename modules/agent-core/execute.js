// Agent Core module — appelle le LLM via un client OpenAI-compatible
module.exports = async function execute(inputs, params, context) {
  const message = inputs?.message
    || (Array.isArray(inputs?.messages) && inputs.messages.length > 0
      ? inputs.messages[inputs.messages.length - 1]?.text || inputs.messages[inputs.messages.length - 1]?.content
      : null);
  if (!message) {
    return { response: 'No input provided' };
  }

  const systemPrompt = params?.system_prompt || '';
  const temperature = params?.temperature ?? 0.7;
  const maxTokens = params?.max_tokens ?? 4096;
  const model = params?.model || 'llama-3.3-70b';

  // Utilise le client LLM fourni par le SDK si dispo, sinon en crée un
  let llm = context?.llm;
  if (!llm) {
    const apiUrl = params?.llm_api_url || 'https://litellm.anteika.fr';
    const apiKey = params?.llm_api_key || '';
    llm = createLLM({ apiUrl, apiKey, model, systemPrompt, temperature, maxTokens });
  }

  const result = await llm.chat(
    [{ role: 'user', content: message }],
    { systemPrompt, model, temperature, maxTokens }
  );

  return { response: result.content };
};

// Client OpenAI-compatible inline (équivalent @agenxia/sdk createLLM)
// pour éviter les soucis d'import ESM depuis un module CommonJS.
function createLLM(options) {
  return {
    async chat(messages, overrides = {}) {
      const opts = { ...options, ...overrides };
      const allMessages = opts.systemPrompt
        ? [{ role: 'system', content: opts.systemPrompt }, ...messages]
        : messages;

      const res = await fetch(`${opts.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          messages: allMessages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 4096,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`LLM API error ${res.status}: ${body}`);
      }

      const data = await res.json();
      return {
        content: data?.choices?.[0]?.message?.content ?? '',
        model: data?.model ?? opts.model,
        usage: data?.usage,
      };
    },
  };
}
