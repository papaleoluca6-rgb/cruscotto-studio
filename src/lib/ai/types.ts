// Provider AI facoltativi: la chiave è dell'utente, l'app funziona del tutto senza (riga 09).

export const AI_PROVIDERS = [
  { id: 'gemini', label: 'Gemini', note: 'serve la VPN in Cina' },
  { id: 'qwen', label: 'Qwen', note: 'funziona in Cina' },
  { id: 'kimi', label: 'Kimi', note: 'funziona in Cina' },
  { id: 'deepseek', label: 'DeepSeek', note: 'funziona in Cina' },
  { id: 'siliconflow', label: 'SiliconFlow', note: 'funziona in Cina' },
  { id: 'modelscope', label: 'ModelScope', note: 'funziona in Cina' },
  { id: 'openai', label: 'OpenAI-compatibile', note: 'indirizzo a scelta' },
] as const

export type AiProviderId = (typeof AI_PROVIDERS)[number]['id']
