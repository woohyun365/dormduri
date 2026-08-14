export type TabId = 'home' | 'list' | 'matching' | 'chat' | 'profile';

export interface MatchingNavOptions {
  readonly section?: 'current' | 'past';
  readonly requestTab?: 'sent' | 'received';
}
