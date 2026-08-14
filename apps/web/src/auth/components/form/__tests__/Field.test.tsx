import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldMessage } from '../Field';

describe('Field primitives', () => {
  it('label, description, error를 하나의 field 계층으로 조합한다', () => {
    render(
      <Field invalid>
        <FieldLabel htmlFor="email">이메일</FieldLabel>
        <input id="email" />
        <FieldDescription>학교 이메일을 입력해요.</FieldDescription>
        <FieldMessage error="이메일을 확인해 주세요." errorId="email-error" />
      </Field>,
    );

    expect(screen.getByLabelText('이메일').closest('[data-slot="field"]')).toHaveAttribute(
      'data-invalid',
      'true',
    );
    expect(screen.getByText('학교 이메일을 입력해요.')).toHaveAttribute(
      'data-slot',
      'field-description',
    );
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'email-error');
    expect(screen.getByRole('alert')).toHaveClass('text-sm', 'leading-5');
  });

  it('입력 helper와 error는 동일한 field-level typography를 사용한다', () => {
    render(
      <FieldMessage descriptionId="nickname-helper">한글 또는 영문으로 입력해요.</FieldMessage>,
    );

    expect(screen.getByText('한글 또는 영문으로 입력해요.')).toHaveClass('text-sm', 'leading-5');
  });

  it('message가 없어도 요청한 field는 안내 공간을 유지한다', () => {
    render(
      <FieldGroup>
        <Field>
          <FieldMessage reserveSpace />
        </Field>
      </FieldGroup>,
    );

    expect(document.querySelector('[data-slot="field-group"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="field-message"]')).toHaveClass('min-h-6');
  });
});
