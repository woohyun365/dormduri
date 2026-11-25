'use client';

import { createContext, useContext } from 'react';
import { errorMessage } from './error-messages';
import type { NoticeTone } from './Notice';

/** The result paragraph of an action, drawn by `Notice` (design guide ⑥). */
export type ResultMessage = {
  readonly tone: NoticeTone;
  readonly role: 'status' | 'alert';
  readonly text: string;
};

/**
 * True inside the console frame, whose shell shows the ended-session notice in its one place (README §4). The sign-in
 * screens have no shell and read false.
 */
export const ShellNoticeContext = createContext(false);

export function success(text: string): ResultMessage {
  return { tone: 'success', role: 'status', text };
}

/**
 * A failure paragraph. In the console a closed session (`session_required`) also brings up the shell's ended notice, an
 * alert, so this paragraph is read after it instead of over it (README §4); its words and place stay. Everywhere
 * else a failure is an alert.
 */
export function useFailure(): (code: Parameters<typeof errorMessage>[0]) => ResultMessage {
  const inShell = useContext(ShellNoticeContext);
  return (code) => ({
    tone: 'danger',
    role: inShell && code === 'session_required' ? 'status' : 'alert',
    text: errorMessage(code),
  });
}

/** A failure paragraph with words of the screen's own (a missing reason, a wrong registration code). */
export function failureText(text: string): ResultMessage {
  return { tone: 'danger', role: 'alert', text };
}
