"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../../config"));
const user_1 = require("../../../enums/user");
// HMAC-SHA256 of the raw FCM/APNs token, keyed by the JWT secret (it's
// already a long-lived secret in env). Storing the hash instead of the
// raw value means a DB leak does not expose every device's push
// credential. The model never persists the raw token in new entries.
//
// Legacy `token` field (raw value) on pre-migration rows is left as-is;
// `tokenHash` is the canonical lookup field going forward. Legacy
// entries will be pruned by the 90-day TTL sweep — or replaced the
// next time the same device logs in.
const hashDeviceToken = (raw) => {
    var _a;
    const secret = ((_a = config_1.default.jwt) === null || _a === void 0 ? void 0 : _a.jwt_secret) || 'fallback-dev-only';
    return crypto_1.default.createHmac('sha256', secret).update(raw).digest('hex');
};
const tokenPrefixOf = (raw) => {
    // Last 6 chars — enough to identify the device in the UI without
    // leaking the rest of the token if the response is later exposed.
    if (!raw)
        return '';
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
const DeviceTokenSchema = new mongoose_1.Schema({
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
const userSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        enum: Object.values(user_1.USER_ROLES),
        default: user_1.USER_ROLES.USER,
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
        required: function () {
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
    gender: {
        type: String,
        enum: ['MALE', 'FEMALE', 'OTHER'],
        required: false,
    },
    dateOfBirth: {
        type: Date,
        required: false,
    },
    profileImage: {
        type: String,
        required: false,
        // Self-hosted SVG — served by `app.use(express.static('public'))`
        // in src/app.ts. Relative path; clients resolve against {{baseUrl}}.
        // Replaces the previous external CDN dependency on i.ibb.co (SPOF).
        default: '/default-avatar.svg',
    },
    location: {
        country: { type: String },
        city: { type: String },
    },
    status: {
        type: String,
        enum: Object.values(user_1.USER_STATUS),
        default: user_1.USER_STATUS.ACTIVE,
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
}, { timestamps: true });
userSchema.index({ 'deviceTokens.token': 1 });
// Cron purge query: find users whose recovery window has expired.
// Compound index speeds up `find({ status: DELETED, recoveryDeadline: { $lt: now } })`.
userSchema.index({ status: 1, recoveryDeadline: 1 });
userSchema.statics.isExistUserById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.User.findById(id);
});
userSchema.statics.isExistUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.User.findOne({ email });
});
userSchema.statics.isMatchPassword = (password, hashPassword) => __awaiter(void 0, void 0, void 0, function* () {
    return yield bcrypt_1.default.compare(password, hashPassword);
});
// Returns true if `plain` matches any hash in the history list. Used by
// change-password and reset-password to block reuse. O(n) bcrypt
// compares — n is capped at PASSWORD_HISTORY_DEPTH (5) so this stays
// fast even at scale.
userSchema.statics.isPasswordReused = (plain, history) => __awaiter(void 0, void 0, void 0, function* () {
    if (!history || history.length === 0)
        return false;
    for (const entry of history) {
        if (entry && entry.hash && (yield bcrypt_1.default.compare(plain, entry.hash))) {
            return true;
        }
    }
    return false;
});
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.password && this.isModified('password')) {
            this.password = yield bcrypt_1.default.hash(this.password, Number(config_1.default.bcrypt_salt_rounds));
        }
        next();
    });
});
// HMAC-SHA256 of a request IP, keyed by the same JWT secret. Lets us
// store enough to identify "is this the same IP as last time?" without
// exposing the actual address if the DB leaks.
const hashIp = (ip) => {
    var _a;
    const secret = ((_a = config_1.default.jwt) === null || _a === void 0 ? void 0 : _a.jwt_secret) || 'fallback-dev-only';
    return crypto_1.default.createHmac('sha256', secret).update(ip).digest('hex');
};
userSchema.statics.addDeviceToken = (userId, token, platform, appVersion, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    const tokenHash = hashDeviceToken(token);
    const tokenPrefix = tokenPrefixOf(token);
    // Resolve session metadata before the DB ops. Lazy-loaded so we
    // don't import GeoIP at module load.
    const { lookupCity } = yield Promise.resolve().then(() => __importStar(require('../../../helpers/geoIpHelper')));
    const ipHash = (metadata === null || metadata === void 0 ? void 0 : metadata.ip) ? hashIp(metadata.ip) : undefined;
    const city = (metadata === null || metadata === void 0 ? void 0 : metadata.ip) ? yield lookupCity(metadata.ip) : null;
    const userAgent = (metadata === null || metadata === void 0 ? void 0 : metadata.userAgent) || undefined;
    const now = new Date();
    // Strip the same device from OTHER users — same physical device
    // signing into a different account should not double-route push.
    // We match on EITHER the raw token (legacy rows) or the hash (new
    // rows) so the migration window doesn't leak duplicates.
    yield exports.User.updateMany({
        _id: { $ne: userId },
        $or: [{ 'deviceTokens.token': token }, { 'deviceTokens.tokenHash': tokenHash }],
    }, {
        $pull: {
            deviceTokens: { $or: [{ token }, { tokenHash }] },
        },
    });
    // Same-user entry already exists? Refresh lastSeenAt + platform.
    // Also migrate the entry in-place: clear the raw `token`, set
    // `tokenHash` + `tokenPrefix` so the row stops storing the raw value.
    // `firstSeenAt` is NOT touched on update — preserves the original
    // first-login timestamp for the session-list UI.
    const updated = yield exports.User.findOneAndUpdate({
        _id: userId,
        deviceTokens: {
            $elemMatch: {
                $or: [{ token: token }, { tokenHash: tokenHash }],
            },
        },
    }, {
        $set: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ 'deviceTokens.$.lastSeenAt': now, 'deviceTokens.$.tokenHash': tokenHash, 'deviceTokens.$.tokenPrefix': tokenPrefix }, (platform ? { 'deviceTokens.$.platform': platform } : {})), (appVersion ? { 'deviceTokens.$.appVersion': appVersion } : {})), (ipHash ? { 'deviceTokens.$.lastSeenIpHash': ipHash } : {})), (city ? { 'deviceTokens.$.lastSeenCity': city } : {})), (userAgent ? { 'deviceTokens.$.userAgent': userAgent } : {})),
        $unset: { 'deviceTokens.$.token': '' },
    }, { new: true });
    if (updated)
        return updated;
    return yield exports.User.findByIdAndUpdate(userId, {
        $push: {
            deviceTokens: Object.assign(Object.assign(Object.assign({ 
                // New entries store hash + prefix only — never the raw token.
                tokenHash,
                tokenPrefix,
                platform,
                appVersion, firstSeenAt: now, lastSeenAt: now }, (ipHash ? { lastSeenIpHash: ipHash } : {})), (city ? { lastSeenCity: city } : {})), (userAgent ? { userAgent } : {})),
        },
    }, { new: true });
});
// Anonymized projection of a soft-deleted user. Other modules use this
// shape when they need to surface "the author of this post" without
// leaking the original identity. See system-concepts.md "Public User
// Display" for the policy.
const DELETED_USER_PROJECTION = {
    name: '[Deleted User]',
    profileImage: '/default-avatar.svg',
};
const projectPublic = (doc) => {
    if (!doc)
        return null;
    const isDeleted = doc.status === user_1.USER_STATUS.DELETED || Boolean(doc.deletedAt);
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
userSchema.statics.findPublicById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = yield exports.User.findById(id)
        .select('_id name profileImage role status deletedAt')
        .lean();
    return projectPublic(doc);
});
userSchema.statics.findPublicByIds = (ids) => __awaiter(void 0, void 0, void 0, function* () {
    const docs = yield exports.User.find({ _id: { $in: ids } })
        .select('_id name profileImage role status deletedAt')
        .lean();
    return docs.map(projectPublic).filter(Boolean);
});
userSchema.statics.removeDeviceToken = (userId, token) => __awaiter(void 0, void 0, void 0, function* () {
    // Match on either the raw token (legacy rows) or the hash (new rows)
    // so logout works across the migration window.
    const tokenHash = hashDeviceToken(token);
    return yield exports.User.findByIdAndUpdate(userId, {
        $pull: {
            deviceTokens: { $or: [{ token }, { tokenHash }] },
        },
    }, { new: true });
});
exports.User = (0, mongoose_1.model)('User', userSchema);
