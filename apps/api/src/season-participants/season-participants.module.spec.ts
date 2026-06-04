import { AuthModule } from '../auth/auth.module.js';
import { DormitoriesModule } from '../dormitories/dormitories.module.js';
import { UsersModule } from '../users/users.module.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from './current-season-participation.controller.js';
import { CurrentSeasonParticipantContextGuard } from './current-season-participant-context.guard.js';
import { CurrentSeasonParticipationViewOwner } from './current-season-participation-view.owner.js';
import {
  SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER,
  SEASON_PARTICIPANT_SOURCE_OWNER,
  SEASON_PARTICIPANT_WRITE_OWNER,
} from './application/season-participant-use-case.tokens.js';
import { SeasonParticipantsModule } from './season-participants.module.js';
import { SeasonParticipantsService } from './application/season-participants.service.js';

function getModuleMetadata<T>(target: object, key: string): T[] {
  return (Reflect.getMetadata(key, target) ?? []) as T[];
}

describe('SeasonParticipantsModule boundary wiring', () => {
  it('season profile/participation controllers는 season-participants module이 소유한다', () => {
    const controllers = getModuleMetadata<unknown>(SeasonParticipantsModule, 'controllers');
    const imports = getModuleMetadata<unknown>(SeasonParticipantsModule, 'imports');

    expect(controllers).toEqual(
      expect.arrayContaining([
        CurrentSeasonProfileController,
        CurrentSeasonParticipationController,
      ]),
    );
    expect(imports).toEqual(expect.arrayContaining([DormitoriesModule, AuthModule]));
  });

  it('UsersModule은 season profile/participation controllers를 controller list에 등록하지 않는다', () => {
    const usersControllers = getModuleMetadata<unknown>(UsersModule, 'controllers');

    expect(usersControllers).not.toContain(CurrentSeasonProfileController);
    expect(usersControllers).not.toContain(CurrentSeasonParticipationController);
  });

  it('current-user season segment는 season-participants public provider로 export한다', () => {
    const providers = getModuleMetadata<unknown>(SeasonParticipantsModule, 'providers');
    const exports = getModuleMetadata<unknown>(SeasonParticipantsModule, 'exports');

    expect(providers).toEqual(
      expect.arrayContaining([
        SeasonParticipantsService,
        CurrentSeasonParticipationViewOwner,
        CurrentSeasonParticipantContextGuard,
        expect.objectContaining({ provide: SEASON_PARTICIPANT_WRITE_OWNER }),
        expect.objectContaining({ provide: SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER }),
        expect.objectContaining({ provide: SEASON_PARTICIPANT_SOURCE_OWNER }),
      ]),
    );
    expect(exports).toEqual(
      expect.arrayContaining([
        SeasonParticipantsService,
        CurrentSeasonParticipationViewOwner,
        CurrentSeasonParticipantContextGuard,
      ]),
    );
    expect(exports).not.toContain(SEASON_PARTICIPANT_WRITE_OWNER);
    expect(exports).not.toContain(SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER);
    expect(exports).not.toContain(SEASON_PARTICIPANT_SOURCE_OWNER);
  });
});
