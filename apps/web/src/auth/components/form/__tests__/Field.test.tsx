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
