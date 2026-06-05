import { User } from '../app/modules/user/user.model';
import config from '../config';
import { USER_ROLES, USER_STATUS } from '../enums/user';
import { logger } from '../shared/logger';

const payload = {
  name: 'Administrator',
  email: config.super_admin.email,
  role: USER_ROLES.SUPER_ADMIN,
  password: config.super_admin.password,
  revertDate: '1970-01-01T00:00:00.000Z',
  dateOfBirth: '1970-01-01T00:00:00.000Z',
  verificationImage: 'https://i.ibb.co/z5YHLV9/profile.png',
  verificationVideo: 'https://i.ibb.co/z5YHLV9/profile.png',
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
