import { describe, expect, it } from 'vitest';
import { HomeActivityPanel } from '../components/HomeActivityPanel';
import { HomeMatchingSummary } from '../components/HomeMatchingSummary';
import { HomeOperationsPanel } from '../components/HomeOperationsPanel';
import { HomePrimaryStateCard } from '../components/HomePrimaryStateCard';

describe('Home componentization baseline', () => {
  it('keeps public Home section facade entry points stable before internal file moves', () => {
    expect(HomePrimaryStateCard).toEqual(expect.any(Function));
    expect(HomeActivityPanel).toEqual(expect.any(Function));
    expect(HomeMatchingSummary).toEqual(expect.any(Function));
    expect(HomeOperationsPanel).toEqual(expect.any(Function));
  });
});
