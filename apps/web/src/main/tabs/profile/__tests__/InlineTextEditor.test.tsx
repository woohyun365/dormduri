import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InlineTextEditor } from '../components/InlineTextEditor';

describe('InlineTextEditor', () => {
  it('편집을 취소하면 draft를 되돌리고, 저장은 trim한 값만 보내며 빈 값은 거절한다', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const view = render(
      <InlineTextEditor
        value="조용한 편이에요"
        onSave={onSave}
        maxLength={20}
        placeholder="소개"
      />,
    );

    await user.click(screen.getByRole('button', { name: '수정' }));
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('조용한 편이에요');
    await user.clear(textarea);
    await user.type(textarea, '바뀐 소개');
    expect(screen.getByText('5/20')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    // 부모가 값을 바꾼 뒤 다시 편집하면 새 값에서 시작한다(취소한 draft가 남지 않는다).
    view.rerender(
      <InlineTextEditor value="아침형이에요" onSave={onSave} maxLength={20} placeholder="소개" />,
    );
    await user.click(screen.getByRole('button', { name: '수정' }));
    expect(screen.getByRole('textbox')).toHaveValue('아침형이에요');

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '  밤에 공부해요  ');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('밤에 공부해요');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
