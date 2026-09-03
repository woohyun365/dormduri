'use client';

import { useState } from 'react';
import { LoginFlowView } from '@/auth/flows/login/LoginFlowView';
import { mapLoginRouteStatus } from '@/auth/flows/login/model/login-route-status';
import { LOGIN_STORY_BASE_ARGS, LOGIN_STORY_ERRORS } from '../auth-story-fixtures';

type LoginResultScenario =
  'invalidCredentials' | 'locked' | 'throttled' | 'network' | 'serverUnavailable' | 'resetComplete';

const RESULT_CONFIG = {
  invalidCredentials: {
    error: LOGIN_STORY_ERRORS.invalidCredentials,
    cooldownLabel: '',
  },
  locked: {
    error: LOGIN_STORY_ERRORS.locked,
    cooldownLabel: '04:44',
  },
  throttled: {
    error: LOGIN_STORY_ERRORS.throttled,
    cooldownLabel: '09:42',
  },
  network: {
    error: LOGIN_STORY_ERRORS.network,
    cooldownLabel: '',
  },
  serverUnavailable: {
    error: LOGIN_STORY_ERRORS.serverUnavailable,
    cooldownLabel: '',
  },
} as const;

const RESET_COMPLETE_STATUS = mapLoginRouteStatus(new URLSearchParams('reset=success'));

export function LoginResultStoryScenario({ scenario }: { scenario: LoginResultScenario }) {
  const [isTriggered, setIsTriggered] = useState(false);
  const isResetComplete = scenario === 'resetComplete';
  const result = isResetComplete ? null : RESULT_CONFIG[scenario];
  const isLocked = isTriggered && scenario === 'locked';
  const isThrottled = isTriggered && scenario === 'throttled';

  return (
    <LoginFlowView
      {...LOGIN_STORY_BASE_ARGS}
      values={{
        ...LOGIN_STORY_BASE_ARGS.values,
        password: 'ExamplePassword123!',
      }}
      uiError={isTriggered ? (result?.error ?? null) : null}
      routeStatus={isResetComplete ? RESET_COMPLETE_STATUS : null}
      isLocked={isLocked}
      isSubmitDisabled={isLocked || isThrottled}
      cooldownLabel={isTriggered ? (result?.cooldownLabel ?? '') : ''}
      onSubmitAction={(event) => {
        event.preventDefault();
        setIsTriggered(true);
      }}
    />
  );
}
