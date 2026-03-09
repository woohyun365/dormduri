import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingChecklist } from '../OnboardingChecklist';
import type { ChecklistItem } from '@/utils/onboarding';

const mockItems: ChecklistItem[] = [
  { id: 'building', label: '건물 선택하기', completed: true, navigateTo: 'building' },
  { id: 'lifestyle', label: '생활패턴 입력하기', completed: false, navigateTo: 'profile' },
  { id: 'intro', label: '자기소개 작성하기', completed: false, navigateTo: 'profile' },
  { id: 'bookmark', label: '첫 룸메이트 찜하기', completed: false, navigateTo: 'list' },
];

describe('OnboardingChecklist', () => {
  it('모든 항목을 렌더링한다', () => {
    render(<OnboardingChecklist items={mockItems} onNavigate={() => {}} onDismiss={() => {}} />);

    expect(screen.getByText('건물 선택하기')).toBeInTheDocument();
    expect(screen.getByText('생활패턴 입력하기')).toBeInTheDocument();
    expect(screen.getByText('자기소개 작성하기')).toBeInTheDocument();
    expect(screen.getByText('첫 룸메이트 찜하기')).toBeInTheDocument();
  });

  it('진행 상태를 표시한다 (완료 수 / 전체 수)', () => {
    render(<OnboardingChecklist items={mockItems} onNavigate={() => {}} onDismiss={() => {}} />);

    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('완료된 항목은 체크 표시를 가진다', () => {
    render(<OnboardingChecklist items={mockItems} onNavigate={() => {}} onDismiss={() => {}} />);

    const buildingItem = screen.getByText('건물 선택하기').closest('[data-checklist-item]');
    expect(buildingItem).toHaveAttribute('data-completed', 'true');
  });

  it('미완료 항목은 체크 표시가 없다', () => {
    render(<OnboardingChecklist items={mockItems} onNavigate={() => {}} onDismiss={() => {}} />);

    const lifestyleItem = screen.getByText('생활패턴 입력하기').closest('[data-checklist-item]');
    expect(lifestyleItem).toHaveAttribute('data-completed', 'false');
  });

  it('미완료 항목 클릭 시 onNavigate가 호출된다', async () => {
    const handleNavigate = vi.fn();
    const user = userEvent.setup();

    render(
      <OnboardingChecklist items={mockItems} onNavigate={handleNavigate} onDismiss={() => {}} />,
    );

    await user.click(screen.getByText('생활패턴 입력하기'));

    expect(handleNavigate).toHaveBeenCalledWith('profile');
  });

  it('완료된 항목 클릭 시 onNavigate가 호출되지 않는다', async () => {
    const handleNavigate = vi.fn();
    const user = userEvent.setup();

    render(
      <OnboardingChecklist items={mockItems} onNavigate={handleNavigate} onDismiss={() => {}} />,
    );

    await user.click(screen.getByText('건물 선택하기'));

    expect(handleNavigate).not.toHaveBeenCalled();
  });

  it('닫기 버튼 클릭 시 onDismiss가 호출된다', async () => {
    const handleDismiss = vi.fn();
    const user = userEvent.setup();

    render(
      <OnboardingChecklist items={mockItems} onNavigate={() => {}} onDismiss={handleDismiss} />,
    );

    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('제목 "시작하기"를 표시한다', () => {
    render(<OnboardingChecklist items={mockItems} onNavigate={() => {}} onDismiss={() => {}} />);

    expect(screen.getByText('시작하기')).toBeInTheDocument();
  });
});
