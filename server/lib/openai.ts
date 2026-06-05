/** OpenAI client configuration for self-hosted deployments. */
export function getOpenAIConfig(): { apiKey: string | undefined; baseURL: string | undefined } {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  };
}
