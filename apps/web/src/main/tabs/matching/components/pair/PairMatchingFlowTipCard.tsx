'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  Home,
  ListChecks,
  LockKeyhole,
  MessageCircle,
  Send,
  UsersRound,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

function PersonBubble({
  label,
  tone,
}: {
  readonly label: string;
  readonly tone: 'indigo' | 'blue';
}) {
  const toneClassName =
    tone === 'indigo'
      ? 'bg-indigo-500 text-white ring-sky-50'
      : 'bg-blue-500 text-white ring-sky-50';

  return (
    <span
      aria-label={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-black ring-2 ${toneClassName}`}
    >
      {label}
    </span>
  );
}

function BubblePair({ confirmed = false }: { readonly confirmed?: boolean }) {
  return (
    <span className="relative flex items-center">
      <PersonBubble label="나" tone="indigo" />
      <span className="-ml-2">
        <PersonBubble label="상대" tone="blue" />
      </span>
      {confirmed ? (
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 ring-2 ring-sky-50">
          <CheckCircle2 className="h-3 w-3 text-white" aria-hidden />
        </span>
      ) : null}
    </span>
  );
}

function FlowStep({
  label,
  title,
  description,
  children,
  last = false,
}: {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly last?: boolean;
}) {
  return (
    <li className={`relative flex min-w-0 items-center gap-3 ${last ? '' : 'pb-3'}`}>
      <span
        className={`relative flex h-14 w-28 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-white shadow-xs ${
          last
            ? ''
            : "after:absolute after:left-1/2 after:top-full after:h-3 after:w-px after:-translate-x-1/2 after:bg-sky-200 after:content-['']"
        }`}
      >
        {children}
      </span>
      <span className="min-w-0 flex-1">
        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
          {label}
        </span>
        <span className="mt-1 block text-xs font-bold text-sky-950">{title}</span>
        <span className="mt-0.5 block break-keep text-[11px] leading-4 text-sky-700">
          {description}
        </span>
      </span>
    </li>
  );
}

function RuleItem({ icon, children }: { readonly icon: ReactNode; readonly children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700">
        {icon}
      </span>
      <span className="min-w-0 break-keep text-[11px] font-semibold leading-4 text-sky-950">
        {children}
      </span>
    </li>
  );
}

type PairMatchingFlowTipCardProps =
  | {
      readonly phase?: 'season-matching';
      readonly requestLimit: number;
      readonly matched: boolean;
    }
  | {
      readonly phase: 'post-match';
      readonly matched: boolean;
    };

export function PairMatchingFlowTipCard(props: PairMatchingFlowTipCardProps) {
  const [expanded, setExpanded] = useState(false);
  const postMatch = props.phase === 'post-match';
  const subtitle = postMatch
    ? props.matched
      ? '프로필 확인 → 입실 준비'
      : '활동 확인 → 다음 시즌 준비'
    : props.matched
      ? '채팅 → 공식 일정 → 호실 선택'
      : '채팅 → 요청 → 수락 → 매칭 확정';

  return (
    <section
      data-design-source="legacy-pair-flow"
      className="overflow-hidden rounded-3xl border border-sky-100 bg-sky-50 shadow-sm"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3.5 text-left outline-none transition hover:bg-sky-100/70 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sky-700 shadow-xs">
            <UsersRound className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-sky-950">2인실 매칭 안내</span>
            <span className="block text-xs text-sky-700">{subtitle}</span>
          </span>
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-sky-600"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-sky-100 px-4 pb-4 pt-3">
              {postMatch ? (
                <PostMatchGuide matched={props.matched} />
              ) : (
                <SeasonMatchingGuide requestLimit={props.requestLimit} matched={props.matched} />
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function SeasonMatchingGuide({
  requestLimit,
  matched,
}: {
  readonly requestLimit: number;
  readonly matched: boolean;
}) {
  if (matched) {
    return <SeasonMatchingActiveGuide />;
  }

  return (
    <>
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-sky-500">
          매칭 흐름
        </p>
        <ol className="space-y-0" aria-label="2인실 매칭 단계">
          <FlowStep
            label="1단계"
            title="채팅으로 먼저 대화하기"
            description="생활 습관이 잘 맞는 상대와 대화해보세요."
          >
            <span className="flex items-center gap-1.5">
              <PersonBubble label="나" tone="indigo" />
              <MessageCircle className="h-4 w-4 text-sky-500" aria-hidden />
              <PersonBubble label="상대" tone="blue" />
            </span>
          </FlowStep>
          <FlowStep
            label="2단계"
            title="매칭 요청 보내기"
            description="룸메 매칭을 원하는 상대에게 요청을 보내요."
          >
            <span className="flex items-center gap-1">
              <PersonBubble label="나" tone="indigo" />
              <Send className="h-3.5 w-3.5 text-sky-500" aria-hidden />
              <PersonBubble label="상대" tone="blue" />
            </span>
          </FlowStep>
          <FlowStep
            label="3단계"
            title="요청 수락"
            description="나·상대가 수락하면 매칭이 확정돼요."
          >
            <BubblePair />
          </FlowStep>
          <FlowStep
            label="4단계"
            title="2인 매칭 확정"
            description="공유 물품·생활 습관 등을 의논해보세요."
            last
          >
            <BubblePair confirmed />
          </FlowStep>
        </ol>
      </div>

      <RuleList label="2인실 매칭 핵심 규칙">
        <RuleItem icon={<Send className="h-3.5 w-3.5" aria-hidden />}>
          보낸 요청은 동시 {requestLimit}건까지
        </RuleItem>
        <RuleItem icon={<Clock3 className="h-3.5 w-3.5" aria-hidden />}>
          5일 또는 매칭 마감까지 유지
        </RuleItem>
        <RuleItem icon={<Check className="h-3.5 w-3.5" aria-hidden />}>
          수락 시 2인 매칭 확정
        </RuleItem>
        <RuleItem icon={<UsersRound className="h-3.5 w-3.5" aria-hidden />}>
          확정 시 다른 미결 요청 자동 종료
        </RuleItem>
      </RuleList>
    </>
  );
}

function SeasonMatchingActiveGuide() {
  return (
    <>
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-sky-500">
          매칭 확정 후 준비
        </p>
        <ol className="space-y-0" aria-label="매칭 확정 후 호실 선택 준비 단계">
          <FlowStep
            label="1단계"
            title="확정 결과 확인"
            description="매칭 상대와 주요 일정을 다시 확인해요."
          >
            <BubblePair confirmed />
          </FlowStep>
          <FlowStep
            label="2단계"
            title="채팅으로 일정 조율"
            description="생활 습관과 호실 선택 준비를 이야기해요."
          >
            <span className="flex items-center gap-1.5">
              <PersonBubble label="나" tone="indigo" />
              <MessageCircle className="h-4 w-4 text-sky-500" aria-hidden />
              <PersonBubble label="상대" tone="blue" />
            </span>
          </FlowStep>
          <FlowStep
            label="3단계"
            title="공식 일정 확인"
            description="학교가 안내한 실제 호실 선택일을 확인해요."
          >
            <Clock3 className="h-6 w-6 text-sky-600" aria-hidden />
          </FlowStep>
          <FlowStep
            label="4단계"
            title="학교 홈페이지에서 호실 선택"
            description="호실 선택은 기숙사 홈페이지에서 진행해요."
            last
          >
            <Building2 className="h-6 w-6 text-sky-600" aria-hidden />
          </FlowStep>
        </ol>
      </div>

      <RuleList label="Season Matching 확정 후 핵심 안내">
        <RuleItem icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden />}>
          상대와 채팅하며 호실 선택을 준비
        </RuleItem>
        <RuleItem icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}>
          실제 선택일은 학교 공식 일정으로 확인
        </RuleItem>
        <RuleItem icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}>
          호실 선택은 학교 홈페이지에서 진행
        </RuleItem>
      </RuleList>
    </>
  );
}

function PostMatchGuide({ matched }: { readonly matched: boolean }) {
  if (!matched) {
    return (
      <>
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-sky-500">
            시즌 정리
          </p>
          <ol className="space-y-0" aria-label="매칭 종료 후 확인 단계">
            <FlowStep
              label="1단계"
              title="이번 시즌 활동 돌아보기"
              description="요청·응답이 어떻게 마무리됐는지 확인해요."
            >
              <ListChecks className="h-6 w-6 text-sky-600" aria-hidden />
            </FlowStep>
            <FlowStep
              label="2단계"
              title="잘 맞는 조건 정리"
              description="대화와 매칭에서 중요했던 조건을 정리해요."
            >
              <ClipboardCheck className="h-6 w-6 text-sky-600" aria-hidden />
            </FlowStep>
            <FlowStep
              label="3단계"
              title="다음 시즌 준비"
              description="매칭 서비스의 아쉬웠던 점은 문의해주세요."
              last
            >
              <CalendarDays className="h-6 w-6 text-sky-600" aria-hidden />
            </FlowStep>
          </ol>
        </div>

        <RuleList label="Post Match 핵심 안내">
          <RuleItem icon={<LockKeyhole className="h-3.5 w-3.5" aria-hidden />}>
            신규 매칭 요청과 응답은 종료
          </RuleItem>
          <RuleItem icon={<ListChecks className="h-3.5 w-3.5" aria-hidden />}>
            이번 시즌 활동은 읽기 전용으로 확인
          </RuleItem>
          <RuleItem icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}>
            다음 시즌이 열리면 새로운 상대를 탐색
          </RuleItem>
        </RuleList>
      </>
    );
  }

  return (
    <>
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-sky-500">
          시즌 정리와 입실 준비
        </p>
        <ol className="space-y-0" aria-label="매칭 확정 후 준비 단계">
          <FlowStep label="1단계" title="나를 살펴보기" description="자신의 생활 습관을 확인해요.">
            <CircleUserRound className="h-6 w-6 text-sky-600" aria-hidden />
          </FlowStep>
          <FlowStep
            label="2단계"
            title="상대와 입실 준비"
            description="생활 습관과 공용 물품을 조율해요."
          >
            <span className="flex items-center gap-1.5">
              <PersonBubble label="나" tone="indigo" />
              <MessageCircle className="h-4 w-4 text-sky-500" aria-hidden />
              <PersonBubble label="상대" tone="blue" />
            </span>
          </FlowStep>
          <FlowStep
            label="3단계"
            title="학교 입사 안내 확인"
            description="입사 일정은 학교 공식 안내를 확인해요."
            last
          >
            <Home className="h-6 w-6 text-sky-600" aria-hidden />
          </FlowStep>
        </ol>
      </div>

      <RuleList label="Post Match 핵심 안내">
        <RuleItem icon={<LockKeyhole className="h-3.5 w-3.5" aria-hidden />}>
          신규 요청·응답과 매칭 해제는 종료
        </RuleItem>
        <RuleItem icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden />}>
          매칭 상대 채팅은 시즌 종료일까지 유지
        </RuleItem>
        <RuleItem icon={<ListChecks className="h-3.5 w-3.5" aria-hidden />}>
          이번 시즌 활동은 읽기 전용으로 확인
        </RuleItem>
        <RuleItem icon={<Home className="h-3.5 w-3.5" aria-hidden />}>
          입실 전 준비는 학교 공식 입사 안내를 확인
        </RuleItem>
      </RuleList>
    </>
  );
}

function RuleList({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-sky-500">
        핵심 안내
      </p>
      <ul
        className="divide-y divide-sky-100 overflow-hidden rounded-2xl border border-sky-100 bg-white"
        aria-label={label}
      >
        {children}
      </ul>
    </div>
  );
}
