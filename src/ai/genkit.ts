import { genkit } from 'genkit'
import { googleAI } from '@genkit-ai/google-genai'

export const GENKIT_MODEL = 'googleai/gemini-2.5-flash-lite'

export const ai = genkit({
  plugins: [googleAI()],
  model: GENKIT_MODEL,
})
