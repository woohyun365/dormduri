/**
 * MatchingTab이 부모 shell에 요청할 수 있는 화면 이동입니다.
 *
 * 이 intent는 policy action이나 API command가 아닙니다. MatchingTab은 현재 상태를 설명한 뒤,
 * 이미 존재하는 feature owner로만 사용자를 안내합니다.
 */
export type MatchingNavigationIntent = 'home' | 'roommate' | 'chat' | 'history' | 'profile';
