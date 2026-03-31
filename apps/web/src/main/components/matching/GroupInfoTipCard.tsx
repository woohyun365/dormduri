'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  Users,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Equal,
  RefreshCcw,
  Lock,
  Ban,
} from 'lucide-react';
import { matchingCardShell } from '@/main/styles/matching';

// ─── Illustration atoms ────────────────────────────────────────────────────

/** Fixed-color bubble for abstract diagram — NOT real user avatars */
function DiagramAvatar({
  label,
  color,
}: {
  label: string;
  color: 'blue' | 'purple' | 'amber-ghost';
}) {
  if (color === 'amber-ghost') {
    return (
      <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-400 bg-amber-50">
        {/* person silhouette in amber */}
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4 text-amber-400"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="8" cy="5" r="2.5" />
          <path d="M3.5 13c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" />
        </svg>
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  const styles =
    color === 'blue' ? 'bg-blue-500 text-white ring-white' : 'bg-purple-500 text-white ring-white';

  return (
    <div
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ${styles}`}
      aria-label={label}
    >
      {label}
    </div>
  );
}

/** Two avatars side-by-side with slight overlap */
function AvatarPair({ showC = false }: { showC?: boolean }) {
  return (
    <div className="flex items-center">
      <DiagramAvatar label="A" color="blue" />
      <div className="-ml-2">
        <DiagramAvatar label="B" color="purple" />
      </div>
      {showC && (
        <div className="-ml-2">
          <DiagramAvatar label="?" color="amber-ghost" />
        </div>
      )}
    </div>
  );
}

/** Three overlapping confirmed avatars */
function AvatarTriple({ dimC = false }: { dimC?: boolean }) {
  return (
    <div className="flex items-center">
      <DiagramAvatar label="A" color="blue" />
      <div className="-ml-2">
        <DiagramAvatar label="B" color="purple" />
      </div>
      <div className={`-ml-2 transition-opacity ${dimC ? 'opacity-40' : 'opacity-100'}`}>
        <DiagramAvatar label="C" color="amber-ghost" />
      </div>
    </div>
  );
}

// ─── Flow step ────────────────────────────────────────────────────────────

interface StepProps {
  avatars: React.ReactNode;
  label: string;
  sublabel: string;
  isLast?: boolean;
}

function FlowStep({ avatars, label, sublabel, isLast = false }: StepProps) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
          {label}
        </span>
        <div className="flex items-center justify-center">{avatars}</div>
        <p className="text-[10px] text-blue-500 whitespace-nowrap">{sublabel}</p>
      </div>
      {!isLast && (
        <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-blue-300 mx-0.5" aria-hidden="true" />
      )}
    </div>
  );
}

// ─── Rule pill ────────────────────────────────────────────────────────────

interface RulePillProps {
  icon: React.ReactNode;
  text: string;
}

function RulePill({ icon, text }: RulePillProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1.5">
      <span className="flex-shrink-0 text-blue-500">{icon}</span>
      <span className="text-[11px] font-semibold text-blue-800 whitespace-nowrap">{text}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export function GroupInfoTipCard() {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${matchingCardShell} border border-blue-200 bg-blue-50/80 backdrop-blur-sm`}
    >
      {/* ── Collapsed trigger ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full px-4 py-3.5 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-800">3인실 매칭 안내</p>
              <p className="truncate text-xs text-blue-500">2인 페어 → 멤버 모집 → 3인 확정</p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-4 w-4 text-blue-400" aria-hidden="true" />
          </motion.div>
        </div>
      </button>

      {/* ── Expanded body ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-blue-200 px-4 pb-4 pt-3 space-y-4">
              {/* Flow diagram */}
              <div>
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
                  매칭 흐름
                </p>
                {/*
                  Horizontal scroll on very narrow viewports so the diagram
                  never wraps mid-step. On typical mobile (≥360px) it fits flat.
                */}
                <div className="overflow-x-auto pb-2 -mx-4 px-4">
                  <div
                    className="flex items-start gap-0 min-w-max pr-4"
                    role="list"
                    aria-label="3인실 매칭 단계"
                  >
                    {/* Step 1 — 2인 페어 */}
                    <div role="listitem">
                      <FlowStep
                        avatars={
                          <div className="flex items-center">
                            <DiagramAvatar label="A" color="blue" />
                            <div className="-ml-2">
                              <DiagramAvatar label="B" color="purple" />
                            </div>
                          </div>
                        }
                        label="1단계"
                        sublabel="2인 페어"
                      />
                    </div>

                    {/* Step 2 — 멤버 모집 or 2인 마감 */}
                    <div role="listitem">
                      <FlowStep
                        avatars={<AvatarPair showC />}
                        label="2단계"
                        sublabel="2인 마감 또는 멤버 모집"
                      />
                    </div>

                    {/* Step 3 — 3인 대화 */}
                    <div role="listitem">
                      <FlowStep avatars={<AvatarTriple />} label="3단계" sublabel="3인 대화" />
                    </div>

                    {/* Step 4 — 확정 (with checkmark badge) */}
                    <div role="listitem">
                      <FlowStep
                        isLast
                        avatars={
                          <div className="relative">
                            <AvatarTriple />
                            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-blue-50">
                              <CheckCircle2 className="h-3 w-3 text-white" aria-hidden="true" />
                            </div>
                          </div>
                        }
                        label="4단계"
                        sublabel="최종 확정"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rule pills */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
                  핵심 규칙
                </p>
                <div className="flex flex-wrap gap-2">
                  <RulePill
                    icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    text="합류 = A·B 모두 수락"
                  />
                  <RulePill
                    icon={<Ban className="h-3.5 w-3.5" aria-hidden="true" />}
                    text="페어 이후 개인 신청 불가"
                  />
                  <RulePill
                    icon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                    text="2인 마감 가능"
                  />
                  <RulePill
                    icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                    text="대화 = 동시 여럿 가능"
                  />
                  <RulePill
                    icon={<Equal className="h-3.5 w-3.5" aria-hidden="true" />}
                    text="확정 후 = 전원 동등"
                  />
                  <RulePill
                    icon={<RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />}
                    text="멤버 이탈 = 남은 2인 페어"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
