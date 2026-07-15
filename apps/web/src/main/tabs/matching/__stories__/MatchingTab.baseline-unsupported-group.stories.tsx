import type { Meta } from '@storybook/nextjs-vite';
import { UnsupportedGroupLegacySnapshot } from './legacy/unsupported-group/UnsupportedGroupLegacySnapshot';

const meta = {
  title: 'Main/MatchingTab/Baseline/Legacy/UnsupportedGroup',
  component: UnsupportedGroupLegacySnapshot,
  parameters: {
    docs: {
      description: {
        component:
          '출시되지 않은 3인 group UI의 historical comparison 전용 story입니다. product runtime, canonical story matrix, acceptance 근거가 아닙니다.',
      },
    },
  },
} satisfies Meta<typeof UnsupportedGroupLegacySnapshot>;

export default meta;

export const HistoricalSnapshot = {};
