export interface SeasonProfileIntroModerationPort {
  moderateSeasonProfileIntro(intro: string): Promise<string>;
}
