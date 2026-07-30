import { LoginForm } from './components/LoginForm';
import { LoginRouteStatusAlert } from './components/LoginRouteStatusAlert';
import { LoginLayout } from './components/LoginLayout';
import { LoginLegalFooter, LoginSignupAction } from './components/LoginSecondaryActions';
import {
  LoginSessionTransition,
  type LoginSessionTransitionState,
} from './components/LoginSessionTransition';
import { LoginSessionUnavailableStatus } from './components/LoginSessionUnavailableStatus';
import type {
  LoginFieldErrors,
  LoginFormSubmitEvent,
  LoginFormValues,
  LoginInvalidField,
  LoginUiErrorState,
} from './model/login-form.types';
import type { LoginRouteStatus } from './model/login-route-status';

interface LoginFlowViewProps {
  sessionTransitionState: LoginSessionTransitionState | null;
  isSessionUnavailable: boolean;
  values: LoginFormValues;
  fieldErrors: LoginFieldErrors;
  uiError: LoginUiErrorState | null;
  routeStatus: LoginRouteStatus | null;
  isSubmitting: boolean;
  isRedirecting: boolean;
  isLocked: boolean;
  isSubmitDisabled: boolean;
  cooldownLabel: string;
  lastInvalidField: LoginInvalidField | null;
  invalidSubmitCount: number;
  onEmailChangeAction: (value: string) => void;
  onPasswordChangeAction: (value: string) => void;
  onRememberMeChangeAction: (value: boolean) => void;
  onPasswordResetAction: () => void;
  onSignupAction: () => void;
  onSubmitAction: (event: LoginFormSubmitEvent) => void;
  onRetrySessionAction: () => void;
}

export function LoginFlowView({
  sessionTransitionState,
  isSessionUnavailable,
  values,
  fieldErrors,
  uiError,
  routeStatus,
  isSubmitting,
  isRedirecting,
  isLocked,
  isSubmitDisabled,
  cooldownLabel,
  lastInvalidField,
  invalidSubmitCount,
  onEmailChangeAction,
  onPasswordChangeAction,
  onRememberMeChangeAction,
  onPasswordResetAction,
  onSignupAction,
  onSubmitAction,
  onRetrySessionAction,
}: LoginFlowViewProps) {
  if (sessionTransitionState) {
    return <LoginSessionTransition state={sessionTransitionState} />;
  }

  return (
    <LoginLayout
      footer={
        <>
          <LoginSignupAction onClick={onSignupAction} />
          <LoginLegalFooter />
        </>
      }
    >
      <LoginForm
        sessionNotice={
          isSessionUnavailable ? (
            <LoginSessionUnavailableStatus onRetryAction={onRetrySessionAction} />
          ) : undefined
        }
        routeNotice={<LoginRouteStatusAlert status={uiError ? null : routeStatus} />}
        values={values}
        fieldErrors={fieldErrors}
        uiError={uiError}
        isSubmitting={isSubmitting}
        isRedirecting={isRedirecting}
        isLocked={isLocked}
        isSubmitDisabled={isSubmitDisabled}
        cooldownLabel={cooldownLabel}
        lastInvalidField={lastInvalidField}
        invalidSubmitCount={invalidSubmitCount}
        onEmailChange={onEmailChangeAction}
        onPasswordChange={onPasswordChangeAction}
        onRememberMeChange={onRememberMeChangeAction}
        onPasswordResetClick={onPasswordResetAction}
        onSubmit={onSubmitAction}
      />
    </LoginLayout>
  );
}
