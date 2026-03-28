export default async function process(inputs, { llm, config }) {
  const { message } = inputs;
  if (!message) return { response: 'No input provided' };
  if (llm) {
    const result = await llm.chat([{ role: 'user', content: message }]);
    return { response: result.content };
  }
  return { response: `Echo: ${message}` };
}
