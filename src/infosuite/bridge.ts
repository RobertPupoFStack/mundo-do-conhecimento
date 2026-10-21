import type { CharacterState } from '../sim/sim';
import type { PlayerClass } from '../sim/types';

export const DEFAULT_INFOSUITE_FUNCTIONS_URL =
  'https://base44.app/api/apps/6ad396b268bd2a7e4b23bd8b/functions';
export const INFOSUITE_ACCESS_TOKEN_KEY = 'mdc-infosuite-runtime-access-token';
export const INFOSUITE_RESUME_TOKEN_KEY = 'mdc-infosuite-runtime-resume-token';

export interface InfoSuiteSessionState {
  session: { id: string; status: string; [key: string]: unknown };
  player: { id: string; display_name?: string; [key: string]: unknown };
  character: {
    id: string;
    rpg_attributes?: { player_class?: PlayerClass; level?: number; [key: string]: unknown };
    world_state?: { character_state?: CharacterState; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface InfoSuiteLaunchResponse {
  access_token: string;
  resume_token: string;
  session_state: InfoSuiteSessionState;
}

export interface InfoSuiteRuntimeFact {
  type: string;
  quest_id?: string;
  metadata?: Record<string, unknown>;
}

export class InfoSuiteBridgeError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InfoSuiteBridgeError';
    this.status = status;
  }
}

export function normalizeFunctionsBaseUrl(value?: string): string {
  const base = (value || DEFAULT_INFOSUITE_FUNCTIONS_URL).trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) {
    throw new Error('A URL da integração InfoSuite deve usar HTTPS.');
  }
  return base;
}

export function createInfoSuiteRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mdc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const functionsBaseUrl = normalizeFunctionsBaseUrl(import.meta.env.VITE_INFOSUITE_FUNCTIONS_URL);

export async function invokeInfoSuite<T>(
  functionName: 'launchSession' | 'studentRuntime',
  payload: Record<string, unknown>,
  options: { keepalive?: boolean } = {},
): Promise<T> {
  const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    keepalive: options.keepalive ?? false,
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // The status still communicates failure if the server did not return JSON.
  }

  if (!response.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : `A integração InfoSuite falhou (HTTP ${response.status}).`;
    throw new InfoSuiteBridgeError(message, response.status);
  }

  return data as T;
}

export const infoSuiteBridge = {
  launch(ticket: string): Promise<InfoSuiteLaunchResponse> {
    if (!ticket.trim()) throw new InfoSuiteBridgeError('Ticket de acesso ausente.', 400);
    return invokeInfoSuite<InfoSuiteLaunchResponse>('launchSession', { ticket });
  },

  read(accessToken: string): Promise<InfoSuiteSessionState> {
    return invokeInfoSuite<InfoSuiteSessionState>('studentRuntime', {
      action: 'read',
      access_token: accessToken,
    });
  },

  resume(resumeToken: string): Promise<InfoSuiteLaunchResponse> {
    return invokeInfoSuite<InfoSuiteLaunchResponse>('studentRuntime', {
      action: 'resume',
      resume_token: resumeToken,
    });
  },

  save(
    accessToken: string,
    snapshot: CharacterState,
    playerClass: PlayerClass,
    reason: 'manual' | 'autosave' | 'exit' | 'quest' | 'milestone' = 'autosave',
    keepalive = false,
  ): Promise<{ ok: boolean; saved_at: string; summary: Record<string, unknown> }> {
    return invokeInfoSuite(
      'studentRuntime',
      {
        action: 'save',
        access_token: accessToken,
        snapshot,
        player_class: playerClass,
        reason,
        request_id: createInfoSuiteRequestId(),
      },
      { keepalive },
    );
  },

  telemetry(
    accessToken: string,
    facts: InfoSuiteRuntimeFact[],
    keepalive = false,
  ): Promise<{ ok: boolean; accepted: number; event_ids: string[] }> {
    if (!facts.length) return Promise.resolve({ ok: true, accepted: 0, event_ids: [] });
    return invokeInfoSuite(
      'studentRuntime',
      {
        action: 'telemetry',
        access_token: accessToken,
        facts,
        request_id: createInfoSuiteRequestId(),
      },
      { keepalive },
    );
  },

  quest(
    accessToken: string,
    questAction: string,
    choiceId?: string,
  ): Promise<Record<string, unknown>> {
    return invokeInfoSuite('studentRuntime', {
      action: 'quest',
      access_token: accessToken,
      quest_action: questAction,
      ...(choiceId ? { choice_id: choiceId } : {}),
    });
  },

  evidence(accessToken: string, eventId: string): Promise<Record<string, unknown>> {
    return invokeInfoSuite('studentRuntime', {
      action: 'evidence',
      access_token: accessToken,
      event_id: eventId,
    });
  },

  experience(
    accessToken: string,
    questCode: string,
    experienceAction: string,
    payload: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    return invokeInfoSuite('studentRuntime', {
      action: 'experience',
      access_token: accessToken,
      quest_code: questCode,
      experience_action: experienceAction,
      payload,
    });
  },
};

export function storeInfoSuiteTokens(accessToken: string, resumeToken: string): void {
  sessionStorage.setItem(INFOSUITE_ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(INFOSUITE_RESUME_TOKEN_KEY, resumeToken);
}

export function readInfoSuiteTokens(): { accessToken: string; resumeToken: string } {
  return {
    accessToken: sessionStorage.getItem(INFOSUITE_ACCESS_TOKEN_KEY) || '',
    resumeToken: sessionStorage.getItem(INFOSUITE_RESUME_TOKEN_KEY) || '',
  };
}

export function clearInfoSuiteTokens(): void {
  sessionStorage.removeItem(INFOSUITE_ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(INFOSUITE_RESUME_TOKEN_KEY);
}
