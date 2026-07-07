import { User } from '../app/modules/user/user.model';
import config from '../config';
import { USER_ROLES, USER_STATUS } from '../enums/user';
import { logger } from '../shared/logger';

const payload = {
  name: 'Administrator',
  email: config.super_admin.email,
  role: USER_ROLES.SUPER_ADMIN,
  password: config.super_admin.password,
  phone: '+10000000000', // added dummy phone to pass validation
  revertDate: '1970-01-01T00:00:00.000Z',
  dateOfBirth: '1970-01-01T00:00:00.000Z',

  isVerified: true,
  status: USER_STATUS.ACTIVE,
};

export const seedSuperAdmin = async () => {
  const isExistSuperAdmin = await User.findOne({
    email: config.super_admin.email,
    role: USER_ROLES.SUPER_ADMIN,
  });
  if (!isExistSuperAdmin) {
    await User.create(payload);
    logger.info('✨ Super Admin account has been successfully created!');
  }
};
