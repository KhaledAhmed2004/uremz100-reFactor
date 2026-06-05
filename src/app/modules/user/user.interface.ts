import { Model, Schema } from 'mongoose';
import { USER_ROLES, USER_STATUS, SUBSCRIPTION_STATUS, SUBSCRIPTION_TIER } from '../../../enums/user';

export type DevicePlatform = 'ios' | 'android' | 'web';

export type IDeviceToken = {
  // Legacy raw FCM/APNs token. Pre-T1-4 rows only. New entries leave
  // this empty and use `tokenHash` as the canonical lookup field.
  token?: string;
  // HMAC-SHA256(rawToken, jwtSecret).hex — the canonical lookup field
  // going forward. Never returned to clients.
  tokenHash?: string;
  // Last 6 chars of the raw token for "ending in XYZA12" UI display.
  // Safe to expose in API responses.
  tokenPrefix?: string;
  platform?: DevicePlatform;
  appVersion?: string;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  // HMAC-SHA256(ip, jwtSecret).hex. Hashed so a DB leak does not expose
  // user IPs. Never returned to clients.
  lastSeenIpHash?: string;
  // Resolved city/country string for session-UI display.
  lastSeenCity?: string;
  // Raw User-Agent header. Plain-stored because it's already self-
  // disclosed on every request.
  userAgent?: string;
};

export type DeviceSessionMetadata = {
  ip?: string;
  userAgent?: string;
};

export interface ILocation {
  country: string;
  city: string;
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IUser {
  name: string;
  email: string;
  password?: string;
  role: USER_ROLES;
  revertDate?: Date;
  dateOfBirth?: Date;
  profileImage?: string;
  verificationImage?: string;
  verificationVideo?: string;
  aboutMe?: string;
  revertStory?: string;
  interests: string[];
  location?: ILocation;
  status: USER_STATUS;
  rejectionReason?: string;
  isVerified: boolean;
  deviceTokens?: IDeviceToken[];
  googleId?: string;
  appleId?: string;
  subscriptionTier: SUBSCRIPTION_TIER;
  subscriptionStatus: SUBSCRIPTION_STATUS;
  subscriptionExpiryDate?: Date;
  appleOriginalTransactionId?: string;
  googlePurchaseToken?: string;
  authentication?: {
    isResetPassword: boolean;
    oneTimeCode: string;
    expireAt: Date;
  };
  passwordHistory?: Array<{
    hash: string;
    changedAt: Date;
  }>;
  emailChange?: {
    newEmail: string | null;
    otp: string | null;
    expireAt: Date | null;
  };
  reverification?: {
    token: string | null;
    expireAt: Date | null;
  };
  tokenVersion: number;
  deletedAt?: Date;
  recoveryDeadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUserProjection = {
  _id: any;
  name: string;
  profileImage: string;
  role: USER_ROLES;
  isDeleted: boolean;
};

export type UserModal = {
  isExistUserById(id: string): any;
  isExistUserByEmail(email: string): any;
  isMatchPassword(password: string, hashPassword: string): boolean;
  isPasswordReused(
    plain: string,
    history: Array<{ hash: string }> | undefined,
  ): Promise<boolean>;

  /**
   * Returns the public-facing projection of a user — what any other
   * caller (group post author, ask-imam questioner, etc.) should
   * display. Soft-deleted users (status DELETED or has deletedAt) are
   * anonymized to "[Deleted User]" with the default avatar, but their
   * `_id` and `role` are preserved so listing queries don't break.
   *
   * Modules that surface user-attributed content should populate via
   * this helper instead of joining the raw User collection — see
   * system-concepts.md "Public User Display".
   */
  findPublicById(id: string | unknown): Promise<PublicUserProjection | null>;
  findPublicByIds(ids: Array<string | unknown>): Promise<PublicUserProjection[]>;

  addDeviceToken(
    userId: string,
    token: string,
    platform?: DevicePlatform,
    appVersion?: string,
    metadata?: DeviceSessionMetadata,
  ): Promise<IUser | null>;
  removeDeviceToken(userId: string, token: string): Promise<IUser | null>;
} & Model<IUser>;
