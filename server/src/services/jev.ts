/**
 * TypeSafe AI "Jev" System One client (Workers-native).
 *
 * Same wire contract the TwinCover backend used through `typesafe-sdk`:
 *   POST {TYPESAFE_BASE_URL}/v1/systemone
 *   Authorization: Bearer {TYPESAFE_API_KEY}
 *   { model, state, questions: { name: { type: 'noul' | 'choice' | 'score', instructions, criteria } } }
 * Answers come back as calibrated probabilities keyed by question name, which
 * makes Jev a decision engine (keep / reject / rank), not a text generator.
 */

export const JEV_DEFAULT_BASE_URL = 'https://api.typesafe.ai';
export const JEV_DEFAULT_MODEL = 'jev-latest';

export interface JevConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  /** Per-request timeout. Default 10s (SDK default). */
  timeoutMs?: number;
}

type JevContent = string | Record<string, unknown> | unknown[];

export interface JevNoulQuestion {
  type: 'noul';
  instructions?: JevContent;
  criteria?: { true?: JevContent | null; false?: JevContent | null };
}

export interface JevChoiceQuestion {
  type: 'choice';
  instructions?: JevContent;
  criteria: Record<string, JevContent | null>;
}

export interface JevScoreQuestion {
  type: 'score';
  instructions?: JevContent;
  criteria: JevContent[];
}

export type JevQuestion = JevNoulQuestion | JevChoiceQuestion | JevScoreQuestion;

export interface JevNoulAnswer {
  type: 'noul';
  /** Probability of yes / true, 0-1. */
  noul: number;
}

export interface JevChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface JevScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend: Record<string, unknown>;
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
}

export function hasJevKey(config?: JevConfig | null): boolean {
  const key = (config?.apiKey || '').trim();
  return key.length > 8 && !key.includes('your_');
}

/** One System One evaluation. Throws on transport/HTTP errors so callers can fall back. */
export async function jevSystemOne(
  config: JevConfig,
  state: JevContent,
  questions: Record<string, JevQuestion>
): Promise<JevResponse> {
  if (!hasJevKey(config)) throw new Error('TYPESAFE_AI_API_KEY is not configured');
  const baseUrl = (config.baseUrl || JEV_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 10_000);
  try {
    const response = await fetch(`${baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey!.trim()}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: config.model || JEV_DEFAULT_MODEL, state, questions }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`Jev System One status ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const json = (await response.json()) as JevResponse;
    if (!json || typeof json.answers !== 'object') throw new Error('Jev System One returned no answers');
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export function noulOf(answer: JevAnswer | undefined, fallback = 0): number {
  return answer?.type === 'noul' && Number.isFinite(answer.noul) ? answer.noul : fallback;
}

export function choiceOf(answer: JevAnswer | undefined): JevChoiceAnswer | null {
  return answer?.type === 'choice' ? answer : null;
}
