import { SetMetadata } from '@nestjs/common';
import { UserRoleName } from '@nirvagam/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (UserRoleName | string)[]) => SetMetadata(ROLES_KEY, roles);
