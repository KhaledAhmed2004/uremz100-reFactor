import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { model, Schema } from 'mongoose';
import config from '../../../config';
import { USER_ROLES, USER_STATUS, SUBSCRIPTION_STATUS, SUBSCRIPTION_TIER } from '../../../enums/user';
import { IDeviceToken, IUser, UserModal } from './user.interface';

// HMAC-SHA256 of the raw FCM/APNs token, keyed by the JWT secret (it's
// already a long-lived secret in env). Storing the hash instead of the
// raw value means a DB leak does not expose every device's push
// credential. The model never persists the raw token in new entries.
//
// Legacy `token` field (raw value) on pre-migration rows is left as-is;
// `tokenHash` is the canonical lookup field going forward. Legacy
// entries will be pruned by the 90-day TTL sweep — or replaced the
// next time the same device logs in.
const hashDeviceToken = (raw: string): string => {
  const secret = (config.jwt?.jwt_secret as string) || 'fallback-dev-only';
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
};

const tokenPrefixOf = (raw: string): string => {
  // Last 6 chars — enough to identify the device in the UI without
  // leaking the rest of the token if the response is later exposed.
  if (!raw) return '';
  return raw.length <= 6 ? raw : `…${raw.slice(-6)}`;
};

// Each entry in `User.deviceTokens` represents one device session for
// push delivery AND for the session-management endpoints
// (GET /users/me/sessions, DELETE /users/me/sessions/:tokenId,
// POST /users/me/sessions/revoke-all). The `_id: true` (default) gives
// each session a stable id we can hand to the client to address it,
// without ever exposing the raw FCM/APNs token value.
//
// NOTE: any token rows written before this change will not have an
// `_id`. They keep working for push but will surface in /sessions with
// `tokenId: null`; users will replace them naturally on next login.
const DeviceTokenSchema = new Schema<IDeviceToken>({
  // Raw FCM/APNs token. Legacy field — pre-T1-4 rows store the raw
  // value here. New rows leave this empty and use `tokenHash` only.
  token: { type: String, required: false },
  // HMAC-SHA256 of the raw token (canonical lookup field).
  tokenHash: { type: String, required: false, index: true },
  // Last 6 chars of the raw token, for "ending in XYZA12" UI display.
  // Safe to expose in API responses — six suffix chars don't enable
  // impersonation on the push surface.
  tokenPrefix: { type: String, required: false },
  platform: { type: String, enum: ['ios', 'android', 'web'] },
  appVersion: { type: String },
  // First time this device was seen. Used by the session-list UI to
  // distinguish "active for 2 years" from "new this morning".
  firstSeenAt: { type: Date, default: () => new Date() },
  lastSeenAt: { type: Date, default: () => new Date() },
  // HMAC-SHA256 of the last-seen IP. Hashed so a DB leak doesn't
  // expose user network addresses. Never returned to the client.
  lastSeenIpHash: { type: String, required: false },
  // Resolved city/country (e.g. "Chicago, IL") for session-UI display.
  // Null when GeoIP is not configured or the IP is private/loopback.
  lastSeenCity: { type: String, required: false },
  // Raw User-Agent string. Stored plain because it's already
  // self-disclosed by the browser/client on every request. UI uses it
  // to label sessions ("Mac · Chrome").
  userAgent: { type: String, required: false },
});

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return !this.googleId && !this.appleId;
      },
      minlength: 8,
      select: false,
    },
    // Capped FIFO of previous password hashes used to block reuse on
    // change-password / reset-password. The current password is NOT in
    // this list — on change/reset, the service pushes the OLD hash here
    // and trims to PASSWORD_HISTORY_DEPTH. select:false so the list is
    // never serialized accidentally.
    passwordHistory: {
      type: [
        {
          hash: { type: String, required: true },
          changedAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
      select: false,
    },
    revertDate: {
      type: Date,
      required: function (this: IUser) {
        return this.role === USER_ROLES.BROTHER || this.role === USER_ROLES.SISTER;
      },
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    profileImage: {
      type: String,
      required: true,
      // Self-hosted SVG — served by `app.use(express.static('public'))`
      // in src/app.ts. Relative path; clients resolve against {{baseUrl}}.
      // Replaces the previous external CDN dependency on i.ibb.co (SPOF).
      default: '/default-avatar.svg',
    },
    verificationImage: {
      type: String,
      required: function (this: IUser) {
        return this.role === USER_ROLES.BROTHER || this.role === USER_ROLES.SISTER;
      },
    },
    verificationVideo: {
      type: String,
      required: function (this: IUser) {
        return this.role === USER_ROLES.BROTHER || this.role === USER_ROLES.SISTER;
      },
    },
    aboutMe: {
      type: String,
    },
    revertStory: {
      type: String,
    },
    interests: {
      type: [String],
      default: [],
    },
    location: {
      country: { type: String },
      city: { type: String },
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING,
    },
    rejectionReason: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    deviceTokens: {
      type: [DeviceTokenSchema],
      default: [],
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    appleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    subscriptionTier: {
      type: String,
      enum: Object.values(SUBSCRIPTION_TIER),
      default: SUBSCRIPTION_TIER.FREE,
    },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.NONE,
    },
    subscriptionExpiryDate: {
      type: Date,
    },
    appleOriginalTransactionId: {
      type: String,
      sparse: true,
      unique: true,
    },
    googlePurchaseToken: {
      type: String,
      sparse: true,
      unique: true,
    },
    authentication: {
      type: {
        isResetPassword: {
          type: Boolean,
          default: false,
        },
        oneTimeCode: {
          type: String,
          default: null,
        },
        expireAt: {
          type: Date,
          default: null,
        },
      },
      select: false,
    },
    // Pending email-change request. Held server-side between
    // POST /users/me/email-change/request and /confirm. Cleared on commit
    // or expiry. Kept in a separate subdoc from `authentication` so the
    // password-reset OTP and email-change OTP can coexist for one user.
    emailChange: {
      type: {
        newEmail: {
          type: String,
          default: null,
          lowercase: true,
          trim: true,
        },
        otp: {
          type: String,
          default: null,
        },
        expireAt: {
          type: Date,
          default: null,
        },
      },
      select: false,
    },
    // Re-verification handle for users whose status was flipped to
    // REJECTED by an admin. Issued + emailed at the moment of rejection;
    // consumed by the public POST /users/reverify endpoint. Public flow
    // because REJECTED users cannot authenticate (login + auth middleware
    // both block them).
    reverification: {
      type: {
        token: {
          type: String,
          default: null,
        },
        expireAt: {
          type: Date,
          default: null,
        },
      },
      select: false,
    },
    deletedAt: {
      type: Date,
    },
    recoveryDeadline: {
      type: Date,
    },
  },
  { timestamps: true },
);

userSchema.index({ 'deviceTokens.token': 1 });

// Cron purge query: find users whose recovery window has expired.
// Compound index speeds up `find({ status: DELETED, recoveryDeadline: { $lt: now } })`.
userSchema.index({ status: 1, recoveryDeadline: 1 });

// Geospatial index for nearby users
userSchema.index({ 'location.coordinates': '2dsphere' });

userSchema.statics.isExistUserById = async (id: string) => {
  return await User.findById(id);
};

userSchema.statics.isExistUserByEmail = async (email: string) => {
  return await User.findOne({ email });
};

userSchema.statics.isMatchPassword = async (
  password: string,
  hashPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashPassword);
};

// Returns true if `plain` matches any hash in the history list. Used by
// change-password and reset-password to block reuse. O(n) bcrypt
// compares — n is capped at PASSWORD_HISTORY_DEPTH (5) so this stays
// fast even at scale.
userSchema.statics.isPasswordReused = async (
  plain: string,
  history: Array<{ hash: string }> | undefined,
): Promise<boolean> => {
  if (!history || history.length === 0) return false;
  for (const entry of history) {
    if (entry && entry.hash && (await bcrypt.compare(plain, entry.hash))) {
      return true;
    }
  }
  return false;
};

userSchema.pre('save', async function (next) {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(
      this.password,
      Number(config.bcrypt_salt_rounds),
    );
  }
  next();
});

// HMAC-SHA256 of a request IP, keyed by the same JWT secret. Lets us
// store enough to identify "is this the same IP as last time?" without
// exposing the actual address if the DB leaks.
const hashIp = (ip: string): string => {
  const secret = (config.jwt?.jwt_secret as string) || 'fallback-dev-only';
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
};

userSchema.statics.addDeviceToken = async (
  userId: string,
  token: string,
  platform?: 'ios' | 'android' | 'web',
  appVersion?: string,
  metadata?: { ip?: string; userAgent?: string },
) => {
  const tokenHash = hashDeviceToken(token);
  const tokenPrefix = tokenPrefixOf(token);

  // Resolve session metadata before the DB ops. Lazy-loaded so we
  // don't import GeoIP at module load.
  const { lookupCity } = await import('../../../helpers/geoIpHelper');
  const ipHash = metadata?.ip ? hashIp(metadata.ip) : undefined;
  const city = metadata?.ip ? await lookupCity(metadata.ip) : null;
  const userAgent = metadata?.userAgent || undefined;
  const now = new Date();

  // Strip the same device from OTHER users — same physical device
  // signing into a different account should not double-route push.
  // We match on EITHER the raw token (legacy rows) or the hash (new
  // rows) so the migration window doesn't leak duplicates.
  await User.updateMany(
    {
      _id: { $ne: userId },
      $or: [{ 'deviceTokens.token': token }, { 'deviceTokens.tokenHash': tokenHash }],
    },
    {
      $pull: {
        deviceTokens: { $or: [{ token }, { tokenHash }] } as any,
      },
    },
  );

  // Same-user entry already exists? Refresh lastSeenAt + platform.
  // Also migrate the entry in-place: clear the raw `token`, set
  // `tokenHash` + `tokenPrefix` so the row stops storing the raw value.
  // `firstSeenAt` is NOT touched on update — preserves the original
  // first-login timestamp for the session-list UI.
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      deviceTokens: {
        $elemMatch: {
          $or: [{ token: token }, { tokenHash: tokenHash }],
        },
      },
    },
    {
      $set: {
        'deviceTokens.$.lastSeenAt': now,
        'deviceTokens.$.tokenHash': tokenHash,
        'deviceTokens.$.tokenPrefix': tokenPrefix,
        ...(platform ? { 'deviceTokens.$.platform': platform } : {}),
        ...(appVersion ? { 'deviceTokens.$.appVersion': appVersion } : {}),
        ...(ipHash ? { 'deviceTokens.$.lastSeenIpHash': ipHash } : {}),
        ...(city ? { 'deviceTokens.$.lastSeenCity': city } : {}),
        ...(userAgent ? { 'deviceTokens.$.userAgent': userAgent } : {}),
      },
      $unset: { 'deviceTokens.$.token': '' },
    },
    { new: true },
  );
  if (updated) return updated;

  return await User.findByIdAndUpdate(
    userId,
    {
      $push: {
        deviceTokens: {
          // New entries store hash + prefix only — never the raw token.
          tokenHash,
          tokenPrefix,
          platform,
          appVersion,
          firstSeenAt: now,
          lastSeenAt: now,
          ...(ipHash ? { lastSeenIpHash: ipHash } : {}),
          ...(city ? { lastSeenCity: city } : {}),
          ...(userAgent ? { userAgent } : {}),
        },
      },
    },
    { new: true },
  );
};

// Anonymized projection of a soft-deleted user. Other modules use this
// shape when they need to surface "the author of this post" without
// leaking the original identity. See system-concepts.md "Public User
// Display" for the policy.
const DELETED_USER_PROJECTION = {
  name: '[Deleted User]',
  profileImage: '/default-avatar.svg',
};

const projectPublic = (doc: any): any => {
  if (!doc) return null;
  const isDeleted =
    doc.status === USER_STATUS.DELETED || Boolean(doc.deletedAt);
  if (isDeleted) {
    return {
      _id: doc._id,
      name: DELETED_USER_PROJECTION.name,
      profileImage: DELETED_USER_PROJECTION.profileImage,
      role: doc.role,
      isDeleted: true,
    };
  }
  return {
    _id: doc._id,
    name: doc.name,
    profileImage: doc.profileImage,
    role: doc.role,
    isDeleted: false,
  };
};

userSchema.statics.findPublicById = async (id: string | unknown) => {
  const doc = await User.findById(id as any)
    .select('_id name profileImage role status deletedAt')
    .lean();
  return projectPublic(doc);
};

userSchema.statics.findPublicByIds = async (ids: Array<string | unknown>) => {
  const docs = await User.find({ _id: { $in: ids as any[] } })
    .select('_id name profileImage role status deletedAt')
    .lean();
  return docs.map(projectPublic).filter(Boolean);
};

userSchema.statics.removeDeviceToken = async (
  userId: string,
  token: string,
) => {
  // Match on either the raw token (legacy rows) or the hash (new rows)
  // so logout works across the migration window.
  const tokenHash = hashDeviceToken(token);
  return await User.findByIdAndUpdate(
    userId,
    {
      $pull: {
        deviceTokens: { $or: [{ token }, { tokenHash }] } as any,
      },
    },
    { new: true },
  );
};

export const User = model<IUser, UserModal>('User', userSchema);
