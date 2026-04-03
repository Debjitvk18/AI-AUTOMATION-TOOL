export const LLM_PROVIDERS = [
  { id: "gemini", label: "Google Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "claude", label: "Anthropic Claude" },
  { id: "bedrock", label: "Amazon Bedrock" },
] as const;

export const LLM_MODELS = {
  gemini: [
    { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Experimental" },
    { id: "gemini-2.0-flash-thinking-exp-1219", label: "Gemini 2.0 Flash Thinking" },
    { id: "gemini-exp-1206", label: "Gemini Experimental 1206" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash-8B" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "gpt-4", label: "GPT-4" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  claude: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Latest)" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    { id: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
  ],
  bedrock: [
    { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", label: "Claude 3.5 Sonnet v2" },
    { id: "anthropic.claude-3-5-haiku-20241022-v1:0", label: "Claude 3.5 Haiku" },
    { id: "amazon.nova-pro-v1:0", label: "Amazon Nova Pro" },
    { id: "amazon.nova-lite-v1:0", label: "Amazon Nova Lite" },
    { id: "amazon.nova-micro-v1:0", label: "Amazon Nova Micro" },
  ],
} as const;

// Legacy export for backward compatibility
export const GEMINI_MODEL_OPTIONS = LLM_MODELS.gemini;
