'use client';

import { ArrowRight, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { ActionButton } from './ActionButton';
import { PrimaryDateRows } from './PrimaryDateRows';
import { PrimaryPolicyHintRotator } from './PrimaryPolicyHintRotator';
import { PrimaryProgressBar } from './PrimaryProgressBar';
import { PrimarySuccessHighlightText } from './PrimarySuccessHighlightText';
import { PrimaryTaskStepCard } from './PrimaryTaskStepCard';
import {
  NOTICE_ICON_CLASS_NAME,
  NOTICE_TONE_CLASS_NAME,
  PRIMARY_INSIGHT_TONE_CLASS_NAMES,
  TONE_STYLES,
} from './model/primaryStyles';
import type { PrimaryContent } from './model/primaryTypes';

interface PrimaryCardFrameProps {
  content: PrimaryContent;
  suppressActions?: boolean;
}

export function PrimaryCardFrame({ content, suppressActions = false }: PrimaryCardFrameProps) {
  const tone = TONE_STYLES[content.tone];
  const Icon = content.icon;
  const shouldRenderActions = !suppressActions && (content.action || content.secondaryAction);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${tone.surface} border-2 ${tone.border} rounded-2xl p-4 keep-all`}
      aria-labelledby="home-primary-state-title"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`h-2 w-2 shrink-0 rounded-full ${tone.status}`} />
          <span className="truncate text-sm font-bold text-(--knu-text-primary)">
            {content.eyebrow}
          </span>
        </div>
        <Icon className={`h-5 w-5 shrink-0 ${tone.icon}`} aria-hidden="true" />
      </div>

      <div className="mb-3">
        {content.meta && (
          <p className={`mb-2 text-xs font-semibold ${tone.accent}`}>{content.meta}</p>
        )}
        <h2
          id="home-primary-state-title"
          className="text-xl font-extrabold leading-snug text-(--knu-text-primary)"
        >
          {content.title}
        </h2>
        {content.body && (
          <p className="mt-2 text-sm leading-relaxed text-(--knu-text-secondary)">{content.body}</p>
        )}
      </div>

      <div className="space-y-3">
        {content.steps && content.steps.length > 0 && (
          <div className="border-t border-white/40 pt-3">
            <p className={`mb-2 text-xs font-bold ${tone.accent}`}>시즌 참여 조건</p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.72fr)] sm:items-stretch">
              <ol className="grid gap-2 sm:grid-cols-2" aria-label="시즌 참여 준비 조건">
                {content.steps
                  .filter((step) => step.id !== 'registration')
                  .map((step) => (
                    <PrimaryTaskStepCard key={step.id} step={step} />
                  ))}
              </ol>
              <div className="flex items-center justify-center" aria-hidden="true">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white/75 text-slate-400 shadow-sm shadow-slate-200/50">
                  <ArrowRight className="h-3.5 w-3.5 rotate-90 sm:rotate-0" />
                </span>
              </div>
              <ol aria-label="시즌 참여 신청 상태">
                {content.steps
                  .filter((step) => step.id === 'registration')
                  .map((step) => (
                    <PrimaryTaskStepCard key={step.id} step={step} emphasis />
                  ))}
              </ol>
            </div>
          </div>
        )}
        {content.progress && <PrimaryProgressBar progress={content.progress} />}
        {content.progress && content.dateRows && content.dateRows.length > 0 && (
          <PrimaryDateRows title={content.dateSectionTitle} rows={content.dateRows} />
        )}
        {content.insights && content.insights.length > 0 && (
          <div className="border-t border-white/40 pt-3">
            {content.insightTitle && (
              <div className="mb-2">
                <p className={`text-xs font-bold ${tone.accent}`}>{content.insightTitle}</p>
                {content.insightSubtitle && (
                  <p className="mt-1 text-xs leading-relaxed text-(--knu-text-tertiary)">
                    {content.insightSubtitle}
                  </p>
                )}
              </div>
            )}
            <div
              className={`grid gap-3 ${content.insights.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}
            >
              {content.insights.map((insight) => {
                const InsightIcon = insight.icon;
                const compactTone = insight.tone
                  ? PRIMARY_INSIGHT_TONE_CLASS_NAMES[insight.tone]
                  : null;
                const compactBody = compactTone ? (
                  <>
                    <div className="mb-1 flex items-center gap-1.5">
                      <InsightIcon className={`size-3.5 ${compactTone.icon}`} aria-hidden="true" />
                      <p className="text-[11px] font-bold text-(--knu-text-tertiary)">
                        {insight.label}
                      </p>
                    </div>
                    <p
                      className={`flex items-baseline gap-1 text-sm font-extrabold ${compactTone.value}`}
                    >
                      <span>{insight.value}</span>
                      {insight.todayNewCount !== undefined && insight.todayNewCount > 0 && (
                        <motion.span
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-xs font-bold text-green-600"
                        >
                          (+{insight.todayNewCount}명)
                        </motion.span>
                      )}
                    </p>
                    {insight.helper && (
                      <p className="mt-0.5 text-[11px] text-(--knu-text-tertiary)">
                        {insight.helper}
                      </p>
                    )}
                  </>
                ) : null;
                const centeredBody = (
                  <>
                    <span className="flex flex-col items-center gap-1.5 text-xs text-(--knu-text-tertiary)">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${insight.iconClassName}`}
                      >
                        <InsightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span>{insight.label}</span>
                    </span>
                    <span className="mt-1 block text-base font-bold text-(--knu-text-primary)">
                      <span>{insight.value}</span>
                      {insight.todayNewCount !== undefined && insight.todayNewCount > 0 && (
                        <motion.span
                          animate={{ scale: [1, 1.12, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="ml-1 inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[11px] font-extrabold text-green-600 ring-1 ring-green-100"
                        >
                          (+{insight.todayNewCount}명)
                        </motion.span>
                      )}
                    </span>
                    {insight.helper && (
                      <p className="mt-0.5 text-[11px] text-(--knu-text-tertiary)">
                        {insight.helper}
                      </p>
                    )}
                  </>
                );
                const metricBody = compactBody ?? centeredBody;
                const metricClassName = compactTone
                  ? compactTone.cell
                  : 'rounded-xl border border-white/70 bg-white/75 p-3 text-center shadow-sm shadow-slate-200/60 backdrop-blur-sm transition-colors';

                return (
                  <div key={insight.label} className={metricClassName}>
                    {metricBody}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!content.progress && content.dateRows && content.dateRows.length > 0 && (
          <PrimaryDateRows title={content.dateSectionTitle} rows={content.dateRows} />
        )}
        {content.notice && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold leading-relaxed shadow-sm shadow-slate-200/40 backdrop-blur-sm ${NOTICE_TONE_CLASS_NAME[content.notice.tone]}`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/85 ${NOTICE_ICON_CLASS_NAME[content.notice.tone]}`}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <p>{content.notice.text}</p>
          </div>
        )}
        {content.successHighlight && (
          <PrimarySuccessHighlightText highlight={content.successHighlight} />
        )}
        {content.policyHints && content.policyHints.length > 0 ? (
          <PrimaryPolicyHintRotator
            hints={content.policyHints}
            ariaLabelPrefix={content.policyHintAriaLabel}
          />
        ) : (
          content.helper && (
            <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/65 p-3 text-xs leading-relaxed text-(--knu-text-secondary) shadow-sm shadow-slate-200/50 backdrop-blur-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-(--knu-primary)">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <p>{content.helper}</p>
            </div>
          )
        )}
        {shouldRenderActions && (
          <div className="flex flex-col sm:flex-row gap-2">
            {content.action && <ActionButton action={content.action} />}
            {content.secondaryAction && <ActionButton action={content.secondaryAction} />}
          </div>
        )}
      </div>
    </motion.section>
  );
}
