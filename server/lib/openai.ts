/** OpenAI client configuration for self-hosted deployments. */
export function getOpenAIConfig(): { apiKey: string | undefined; baseURL: string | undefined } {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  };
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export type AiModuleStatus = {
  configured: boolean;
  modules: {
    assistant: boolean;
    chat: boolean;
    dashboard: boolean;
    business: boolean;
    surveys: boolean;
    documents: boolean;
  };
};

/** Which modules can use OpenAI (server-side key present). */
export function getAiModuleStatus(): AiModuleStatus {
  const configured = isOpenAIConfigured();
  const chatEnabled =
    configured && process.env.CHAT_AI_ENABLED !== "false";
  return {
    configured,
    modules: {
      assistant: configured,
      chat: chatEnabled,
      dashboard: configured,
      business: configured,
      surveys: configured,
      documents: false,
    },
  };
}
