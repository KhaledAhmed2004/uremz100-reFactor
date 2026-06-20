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
exports.UserService = void 0;
const http_status_codes_1 = require("http-status-codes");
const user_1 = require("../../../enums/user");
const mongoose_1 = require("mongoose");
const subscription_model_1 = require("../subscription/subscription.model");
const notification_model_1 = require("../notification/notification.model");
const subscription_event_model_1 = require("../subscription/subscription-event.model");
const support_ticket_model_1 = require("../support-ticket/support-ticket.model");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const emailHelper_1 = require("../../../helpers/emailHelper");
const emailTemplate_1 = require("../../../shared/emailTemplate");
const authHelpers_1 = require("../../../helpers/authHelpers");
const unlinkFile_1 = __importDefault(require("../../../shared/unlinkFile"));
const generateOTP_1 = __importDefault(require("../../../util/generateOTP"));
const user_model_1 = require("./user.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const auth_constants_1 = require("../../../config/auth.constants");
const cryptoToken_1 = __importDefault(require("../../../util/cryptoToken"));
const guestMigration_1 = require("../../../helpers/guestMigration");
const mongoose_2 = __importDefault(require("mongoose"));
const createUserToDB = (payload_1, ...args_1) => __awaiter(void 0, [payload_1, ...args_1], void 0, function* (payload, isAdmin = false, guestId) {
    const session = yield mongoose_2.default.startSession();
    try {
        session.startTransaction();
        // 1. Email Uniqueness Check (409 Conflict)
        const existingUser = yield user_model_1.User.findOne({ email: payload.email }).session(session);
        if (existingUser) {
            if (existingUser.isVerified) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email already registered');
            }
            else {
                // Handle pending account: If created < 24h, block. If > 24h, delete and recreate.
                const dayInMs = 24 * 60 * 60 * 1000;
                const isRecent = Date.now() - new Date(existingUser.createdAt).getTime() < dayInMs;
                if (isRecent) {
                    throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'Email already registered and pending verification');
                }
                else {
                    yield user_model_1.User.findByIdAndDelete(existingUser._id).session(session);
                }
            }
        }
        // 2. Prepare User Data
        const userData = Object.assign(Object.assign({}, payload), { isVerified: isAdmin ? true : false, status: isAdmin ? user_1.USER_STATUS.ACTIVE : user_1.USER_STATUS.PENDING });
        // 3. Create User
        const [createUser] = yield user_model_1.User.create([userData], { session });
        if (!createUser) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Failed to create user');
        }
        // Initialize Reward Wallet and Progress
        const { Wallet, UserRewardProgress } = yield Promise.resolve().then(() => __importStar(require('../reward/reward.model')));
        yield Wallet.create([{ user: createUser._id, goldBalance: 0, bonusLedger: [] }], { session });
        yield UserRewardProgress.create([{ user: createUser._id }], { session });
        // 4. Send Verification OTP (Only for public registration)
        if (!isAdmin) {
            // Note: sendVerificationOTP must also support session if it writes to DB
            yield (0, authHelpers_1.sendVerificationOTP)(createUser.email, session);
        }
        // 5. Migrate guest data
        if (guestId) {
            yield (0, guestMigration_1.migrateGuestDataToUser)(guestId, createUser._id);
        }
        yield session.commitTransaction();
        return createUser;
    }
    catch (err) {
        yield session.abortTransaction();
        throw err;
    }
    finally {
        session.endSession();
    }
});
const getUserProfileFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.findById(id)
        .select('-password -authentication -tokenVersion -deviceTokens -deletedAt')
        .lean();
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    // Flatten location for consistency with list API
    if (isExistUser.location) {
        isExistUser.country = isExistUser.location.country;
        isExistUser.city = isExistUser.location.city;
        delete isExistUser.location;
    }
    return isExistUser;
});
const updateProfileToDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const isExistUser = yield user_model_1.User.isExistUserById(id);
    if (!isExistUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    // //unlink file here
    // if (payload.image) {
    //   unlinkFile(isExistUser.image);
    // }
    //unlink file here
    if (payload.profileImage) {
        (0, unlinkFile_1.default)(isExistUser.profileImage);
    }
    // Transform location (legacy latitude/longitude mapping removed)
    if (payload.location) {
        payload.location = payload.location;
    }
    const updateDoc = yield user_model_1.User.findOneAndUpdate({ _id: id }, payload, {
        new: true,
    });
    return updateDoc;
});
const getAllUsersFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const userQuery = new QueryBuilder_1.default(user_model_1.User.find(), query)
        .search(['name', 'email'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const users = yield userQuery.modelQuery;
    const paginationInfo = yield userQuery.getPaginationInfo();
    return {
        meta: paginationInfo,
        data: users,
    };
});
const getUserMetricsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const aggregationBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const excludeAdminFilter = { role: { $ne: user_1.USER_ROLES.SUPER_ADMIN } };
    // Overall user growth (excluding SUPER_ADMIN)
    const totalStats = yield aggregationBuilder.calculateGrowth({
        filter: excludeAdminFilter,
        period: 'month'
    });
    // Status based growth (excluding SUPER_ADMIN)
    aggregationBuilder.reset();
    const activeStats = yield aggregationBuilder.calculateGrowth({
        filter: Object.assign(Object.assign({}, excludeAdminFilter), { status: user_1.USER_STATUS.ACTIVE }),
        period: 'month'
    });
    aggregationBuilder.reset();
    const subscribedStats = yield aggregationBuilder.calculateGrowth({
        filter: Object.assign(Object.assign({}, excludeAdminFilter), { subscriptionStatus: 'active' }),
        period: 'month'
    });
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: stat.growth,
        direction: stat.growthType === 'increase' ? 'up' : stat.growthType === 'decrease' ? 'down' : 'neutral',
    });
    return {
        meta: {
            comparisonPeriod: 'month',
        },
        totalUsers: formatMetric(totalStats),
        activeUsersNewThisMonth: formatMetric(activeStats),
        totalSubscribedNewThisMonth: formatMetric(subscribedStats),
    };
});
const getAllUserRolesFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm, email, role, status, isVerified, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const match = {
        role: { $ne: user_1.USER_ROLES.SUPER_ADMIN },
    };
    if (status)
        match.status = status;
    if (isVerified !== undefined)
        match.isVerified = isVerified === 'true' ? true : isVerified === 'false' ? false : isVerified;
    if (role)
        match.role = role;
    if (email)
        match.email = { $regex: email, $options: 'i' };
    if (searchTerm) {
        match.$or = [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
        ];
    }
    const basePipeline = [
        { $match: match },
        {
            $lookup: {
                from: 'wallets',
                localField: '_id',
                foreignField: 'user',
                as: 'walletData'
            }
        },
        {
            $lookup: {
                from: 'subscriptions',
                localField: '_id',
                foreignField: 'userId',
                as: 'subscriptionData'
            }
        },
        {
            $addFields: {
                subscriptionPlan: { $ifNull: [{ $arrayElemAt: ['$subscriptionData.plan', 0] }, 'FREE'] },
                subscriptionStatus: { $ifNull: [{ $arrayElemAt: ['$subscriptionData.status', 0] }, 'INACTIVE'] },
                coins: {
                    $let: {
                        vars: {
                            wallet: { $arrayElemAt: ['$walletData', 0] }
                        },
                        in: {
                            $add: [
                                { $ifNull: ['$$wallet.goldBalance', 0] },
                                { $reduce: {
                                        input: { $ifNull: ['$$wallet.bonusLedger', []] },
                                        initialValue: 0,
                                        in: { $add: ['$$value', '$$this.amount'] }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            $project: status === user_1.USER_STATUS.PENDING
                ? {
                    _id: 1,
                    name: 1,
                    email: 1,
                    role: 1,
                    createdAt: 1,
                }
                : {
                    _id: 1,
                    name: 1,
                    email: 1,
                    phone: 1,
                    status: 1,
                    isVerified: 1,
                    role: 1,
                    profileImage: 1,
                    subscriptionPlan: 1,
                    subscriptionStatus: 1,
                    coins: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
        },
    ];
    const sortStage = {
        $sort: { [sortBy]: sortOrder === -1 ? -1 : 1 },
    };
    const paginatedPipeline = [
        ...basePipeline,
        sortStage,
        { $skip: skip },
        { $limit: Number(limit) },
    ];
    const countPipeline = [
        ...basePipeline,
        { $count: 'total' },
    ];
    const [data, countResult] = yield Promise.all([
        user_model_1.User.aggregate(paginatedPipeline),
        user_model_1.User.aggregate(countPipeline),
    ]);
    const total = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(total / Number(limit));
    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
        },
        data,
    };
});
const getUserProfilesFromDB = (user, query) => __awaiter(void 0, void 0, void 0, function* () {
    const { searchTerm, limit: rawLimit = 10, nextCursor, latitude, longitude, filter, // 'new-reverts' or 'nearby-me'
     } = query;
    const limit = Math.min(Number(rawLimit) || 10, 50);
    // Enforce same-role discovery and ACTIVE status only
    const match = {
        role: user.role,
        status: user_1.USER_STATUS.ACTIVE,
        _id: { $ne: new mongoose_1.Types.ObjectId(user.id) }, // Exclude self
        deletedAt: { $exists: false }
    };
    if (searchTerm) {
        match.$or = [
            { name: { $regex: searchTerm, $options: 'i' } },
        ];
    }
    // Cursor-based pagination: decode cursor and add _id filter
    if (nextCursor && typeof nextCursor === 'string') {
        let decodedCursorValue = nextCursor;
        try {
            decodedCursorValue = Buffer.from(nextCursor, 'base64').toString('ascii');
        }
        catch (e) {
            // Fallback if not valid base64
        }
        if (mongoose_1.Types.ObjectId.isValid(decodedCursorValue)) {
            // Default sort is descending (newest first), so we need $lt for next page
            match._id = Object.assign(Object.assign({}, match._id), { $lt: new mongoose_1.Types.ObjectId(decodedCursorValue) });
        }
    }
    const pipeline = [];
    // 1. Proximity Search & Sorting Logic
    pipeline.push({ $match: match });
    pipeline.push({ $sort: { _id: -1 } });
    // 2. Projection & Derived Fields
    pipeline.push({
        $project: {
            _id: 1,
            name: 1,
            profileImage: 1,
            age: {
                $dateDiff: {
                    startDate: '$dateOfBirth',
                    endDate: '$$NOW',
                    unit: 'year',
                },
            },
        },
    });
    // 6. Cursor pagination: fetch limit + 1 to detect if there is a next page
    pipeline.push({ $limit: limit + 1 });
    const result = yield user_model_1.User.aggregate(pipeline);
    const hasNext = result.length > limit;
    const data = hasNext ? result.slice(0, limit) : result;
    let newCursor = null;
    if (hasNext && data.length > 0) {
        const lastItem = data[data.length - 1];
        const lastValue = String(lastItem._id);
        newCursor = Buffer.from(lastValue).toString('base64');
    }
    return {
        data,
        meta: {
            limit,
            nextCursor: newCursor,
            hasNext,
        },
    };
});
const getUserByIdFromDB = (id, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id).select('-password -authentication -tokenVersion -deviceTokens -deletedAt').lean();
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    // Admin specific view: can see all fields except excluded ones above
    // Flatten location for consistency with other profile APIs
    if (user.location) {
        user.country = user.location.country;
        user.city = user.location.city;
        delete user.location;
    }
    return user;
});
// Statuses that should make every live JWT for the user stop working
// immediately. We bump `tokenVersion` on flips INTO these so a stolen or
// in-flight token can't keep being used after the admin acts.
const SESSION_INVALIDATING_STATUSES = [
    user_1.USER_STATUS.SUSPENDED,
    user_1.USER_STATUS.RESTRICTED,
    user_1.USER_STATUS.DELETED,
    user_1.USER_STATUS.REJECTED,
    user_1.USER_STATUS.INACTIVE,
];
const updateUserStatusInDB = (id, status) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id).select('+authentication'); // Need authentication for isVerified check
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    // Safety checks for "Review" transitions (Reviewing from PENDING to ACTIVE/REJECTED)
    const isReviewProcess = (status === user_1.USER_STATUS.ACTIVE || status === user_1.USER_STATUS.REJECTED) && user.status === user_1.USER_STATUS.PENDING;
    if (isReviewProcess) {
        if (!user.isVerified) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'User must verify OTP before admin approval');
        }
    }
    // Detect the REJECTED transition. When an admin flips a user to
    // REJECTED, we (a) issue a one-time re-verification token,
    // (b) persist it on the user with a 24h expiry, and (c) email it to
    // the user so they can re-submit their docs via the public
    // POST /users/reverify endpoint. The user cannot log in in this
    // state (auth middleware blocks REJECTED), so a token-based public
    // flow is the only recovery path.
    const flippingToRejected = status === user_1.USER_STATUS.REJECTED && user.status !== user_1.USER_STATUS.REJECTED;
    // Detect any flip INTO a session-invalidating status. The auth
    // middleware already 403s these users on the next request because
    // of the status check — bumping tokenVersion is defense-in-depth so
    // a token in flight at the moment of the admin action is also dead.
    const flippingToLockout = SESSION_INVALIDATING_STATUSES.includes(status) && user.status !== status;
    const update = { status };
    let reverifyToken = null;
    if (flippingToRejected) {
        reverifyToken = (0, cryptoToken_1.default)();
        update.reverification = {
            token: reverifyToken,
            expireAt: new Date(Date.now() + auth_constants_1.REVERIFY_TOKEN_TTL_MS),
        };
    }
    const dbUpdate = { $set: update };
    if (flippingToLockout) {
        dbUpdate.$inc = { tokenVersion: 1 };
    }
    const updatedUser = yield user_model_1.User.findByIdAndUpdate(id, dbUpdate, { new: true });
    if (flippingToRejected && reverifyToken && updatedUser) {
        yield emailHelper_1.emailHelper.enqueue(emailTemplate_1.emailTemplate.accountRejected({
            email: updatedUser.email,
            name: updatedUser.name,
            reverifyToken,
            reverifyTtlHours: auth_constants_1.REVERIFY_TOKEN_TTL_HOURS,
        }), { kind: 'account_rejected_reverify' });
    }
    return updatedUser;
});
const deleteUserPermanentlyFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id);
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const deletedUser = yield user_model_1.User.findByIdAndDelete(id)
        .select('-password -authentication');
    return deletedUser;
});
const updateUserByAdminInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Pull tokenVersion so we can bump it locally on lockout transitions.
    // password stays selected for the schema's bcrypt pre-save hook.
    const user = yield user_model_1.User.findById(id).select('+password +tokenVersion');
    if (!user) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, "User doesn't exist!");
    }
    const previousStatus = user.status;
    // Email uniqueness — admin can change a user's email, but the change
    // must not collide with another active account. Without this check the
    // model's unique index trips an E11000 at .save() that surfaces as a
    // confusing 500 instead of the documented 409.
    if (payload.email !== undefined && payload.email !== user.email) {
        const taken = yield user_model_1.User.findOne({
            email: payload.email,
            _id: { $ne: user._id },
            status: { $ne: user_1.USER_STATUS.DELETED },
        }).lean();
        if (taken) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
        }
    }
    // Whitelist fields admin can update (excluding password/auth info)
    if (payload.name !== undefined)
        user.name = payload.name;
    if (payload.email !== undefined)
        user.email = payload.email;
    if (payload.dateOfBirth !== undefined)
        user.dateOfBirth = payload.dateOfBirth;
    if (payload.location !== undefined) {
        user.location = payload.location;
    }
    if (payload.gender !== undefined)
        user.gender = payload.gender;
    if (payload.profileImage !== undefined)
        user.profileImage = payload.profileImage;
    if (payload.status !== undefined)
        user.status = payload.status;
    if (payload.role !== undefined)
        user.role = payload.role;
    // Status-change side effects — must stay in sync with updateUserStatusInDB
    // because this endpoint is the "combined" admin update that can also flip
    // status. Without this hook, an admin who flips status via this route
    // bypasses both the reverify-token email and the tokenVersion bump.
    const newStatus = user.status;
    const statusChanged = payload.status !== undefined && newStatus !== previousStatus;
    const flippingToRejected = statusChanged && newStatus === user_1.USER_STATUS.REJECTED;
    const flippingToLockout = statusChanged && SESSION_INVALIDATING_STATUSES.includes(newStatus);
    let reverifyToken = null;
    if (flippingToRejected) {
        reverifyToken = (0, cryptoToken_1.default)();
        user.reverification = {
            token: reverifyToken,
            expireAt: new Date(Date.now() + auth_constants_1.REVERIFY_TOKEN_TTL_MS),
        };
    }
    if (flippingToLockout) {
        user.tokenVersion = ((_a = user.tokenVersion) !== null && _a !== void 0 ? _a : 0) + 1;
    }
    yield user.save();
    if (flippingToRejected && reverifyToken) {
        yield emailHelper_1.emailHelper.enqueue(emailTemplate_1.emailTemplate.accountRejected({
            email: user.email,
            name: user.name,
            reverifyToken,
            reverifyTtlHours: auth_constants_1.REVERIFY_TOKEN_TTL_HOURS,
        }), { kind: 'account_rejected_reverify' });
    }
    const plain = user.toObject();
    delete plain.password;
    delete plain.authentication;
    delete plain.tokenVersion;
    delete plain.reverification;
    return plain;
});
const getUserDetailsByIdFromDB = (id, requester) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id).select('_id name role profileImage location isVerified createdAt status deletedAt');
    // 1. Check existence and visibility
    if (!user || user.status !== user_1.USER_STATUS.ACTIVE || user.deletedAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
    }
    // 2. Role-based privacy: BROTHER sees BROTHER, SISTER sees SISTER
    const isSuperAdmin = requester.role === user_1.USER_ROLES.SUPER_ADMIN;
    if (!isSuperAdmin && requester.role !== user.role) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.FORBIDDEN, "You don't have permission to view this profile");
    }
    // Convert to object and return
    const result = user.toObject();
    // Flatten location for convenience if needed, or keep as is
    if (result.location) {
        result.country = result.location.country;
        result.city = result.location.city;
        delete result.location;
    }
    // Final cleanup of internal status/flags
    delete result.status;
    delete result.deletedAt;
    return result;
});
const SOFT_DELETE_RECOVERY_DAYS = 30;
const requestAccountDeletionFromDB = (user, password) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    // Pull password + tokenVersion explicitly — both are select: false on the schema.
    const dbUser = yield user_model_1.User.findById(id).select('+password +tokenVersion');
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    if (dbUser.status === user_1.USER_STATUS.DELETED) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Account is already scheduled for deletion');
    }
    // Defense-in-depth: stolen token alone must not be enough to wipe an account.
    if (!dbUser.password) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password-less accounts (Google/Apple) cannot be deleted via this endpoint yet');
    }
    const passwordOk = yield user_model_1.User.isMatchPassword(password, dbUser.password);
    if (!passwordOk) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Incorrect password');
    }
    const now = new Date();
    const recoveryDeadline = new Date(now.getTime() + SOFT_DELETE_RECOVERY_DAYS * 24 * 60 * 60 * 1000);
    // Bumping tokenVersion immediately invalidates every JWT this user holds.
    yield user_model_1.User.findByIdAndUpdate(id, {
        $set: {
            status: user_1.USER_STATUS.DELETED,
            deletedAt: now,
            recoveryDeadline,
            // Drop push targets — the user is logically gone until they restore.
            deviceTokens: [],
        },
        $inc: { tokenVersion: 1 },
    });
    return {
        deletedAt: now.toISOString(),
        recoveryDeadline: recoveryDeadline.toISOString(),
        recoveryWindowDays: SOFT_DELETE_RECOVERY_DAYS,
    };
});
const requestEmailChangeFromDB = (user, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    const { newEmail, password } = payload;
    // Pull password explicitly — select: false on the schema.
    const dbUser = yield user_model_1.User.findById(id).select('+password');
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    if (!dbUser.password) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Password-less accounts (Google/Apple) cannot change email via this endpoint yet');
    }
    const passwordOk = yield user_model_1.User.isMatchPassword(password, dbUser.password);
    if (!passwordOk) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Incorrect password');
    }
    // Reject no-op changes early so the user gets a clear message instead of
    // silently consuming an OTP slot.
    if (dbUser.email === newEmail) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'New email is the same as the current email');
    }
    // Uniqueness — exclude soft-deleted users so a recoverable account doesn't
    // permanently block its own email.
    const taken = yield user_model_1.User.findOne({
        email: newEmail,
        _id: { $ne: dbUser._id },
        status: { $ne: user_1.USER_STATUS.DELETED },
    }).lean();
    if (taken) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
    }
    const otp = (0, generateOTP_1.default)();
    const expireAt = new Date(Date.now() + auth_constants_1.OTP_TTL_MS);
    yield user_model_1.User.findByIdAndUpdate(id, {
        $set: {
            emailChange: { newEmail, otp, expireAt },
        },
    });
    // OTP to the NEW email — proves the user controls that inbox.
    yield emailHelper_1.emailHelper.enqueue(emailTemplate_1.emailTemplate.changeEmail({ newEmail, otp }), { kind: 'email_change_otp' });
    // Heads-up to the OLD email — catches takeover attempts where the
    // attacker has the password but not the original inbox.
    yield emailHelper_1.emailHelper.enqueue(emailTemplate_1.emailTemplate.emailChangeNotification({
        oldEmail: dbUser.email,
        newEmail,
    }), { kind: 'email_change_notification' });
    return {
        newEmail,
        expireAt: expireAt.toISOString(),
        otpTtlSeconds: auth_constants_1.OTP_TTL_MS / 1000,
    };
});
const confirmEmailChangeFromDB = (user, otp) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    // Pull emailChange + tokenVersion explicitly — both are select: false.
    const dbUser = yield user_model_1.User.findById(id).select('+emailChange +tokenVersion');
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const pending = dbUser.emailChange;
    if (!pending || !pending.newEmail || !pending.otp || !pending.expireAt) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'No pending email-change request');
    }
    if (pending.expireAt.getTime() <= Date.now()) {
        // Clear the stale request so a fresh one can replace it.
        yield user_model_1.User.findByIdAndUpdate(id, {
            $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
        });
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'OTP has expired');
    }
    if (pending.otp !== otp) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid OTP');
    }
    // Re-check uniqueness at commit time — someone else may have grabbed the
    // address while this OTP was outstanding.
    const taken = yield user_model_1.User.findOne({
        email: pending.newEmail,
        _id: { $ne: dbUser._id },
        status: { $ne: user_1.USER_STATUS.DELETED },
    }).lean();
    if (taken) {
        yield user_model_1.User.findByIdAndUpdate(id, {
            $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
        });
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
    }
    // Commit: flip email, clear pending, bump tokenVersion to invalidate every
    // JWT issued under the old identifier. User must log in again with the new
    // email.
    //
    // Race: even though we re-checked uniqueness above, a parallel commit
    // from another user (also racing for the same address) can squeeze in
    // between the check and the write. The unique index on `email` then
    // throws E11000 — we catch it and surface the same `409 "This email is
    // already in use"` the pre-check would have produced. This is the final
    // safety net for the uniqueness invariant.
    try {
        yield user_model_1.User.findByIdAndUpdate(id, {
            $set: {
                email: pending.newEmail,
                emailChange: { newEmail: null, otp: null, expireAt: null },
            },
            $inc: { tokenVersion: 1 },
        });
    }
    catch (err) {
        if ((err === null || err === void 0 ? void 0 : err.code) === 11000) {
            // Mongo unique-key violation — another user already owns the
            // address. Clear the pending request so the user can start over.
            yield user_model_1.User.findByIdAndUpdate(id, {
                $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
            });
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.CONFLICT, 'This email is already in use');
        }
        throw err;
    }
    return {
        email: pending.newEmail,
    };
});
// GDPR data export. Aggregates everything the system stores ABOUT this
// user into a single JSON envelope, then returns it synchronously. The
// caller (controller) wraps it in the standard success envelope.
//
// What's included: the user's own profile (sensitive auth fields stripped),
// their notifications, their subscription history (kept across purge for
// audit), their group activity, and their ask-imam questions.
//
// What's excluded: password hash, the `authentication` and `emailChange`
// OTP subdocs, `tokenVersion`, raw push-notification `deviceTokens` values
// (we expose only the metadata: platform, appVersion, lastSeenAt).
// Sessions = entries in User.deviceTokens. Each entry has a stable
// Mongoose subdoc `_id` (since v2 of the schema) which we expose as
// `tokenId` to the client. The raw FCM/APNs token value is NEVER
// returned — it's a credential that would let a third party hijack
// push delivery.
// Public flow: a REJECTED user submits the token they received by email
// after the admin flipped them, along with a fresh verificationImage +
// verificationVideo. We validate the token, swap in the new files (and
// optionally a new profileImage), unlink the old verification artifacts,
// reset status to PENDING so the admin queue picks the user up again,
// and clear the one-time token. The user still cannot log in until an
// admin approves them again.
const reverifyAccountFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { token, profileImage } = payload;
    const dbUser = yield user_model_1.User.findOne({
        'reverification.token': token,
        status: user_1.USER_STATUS.REJECTED,
    }).select('+reverification');
    if (!dbUser) {
        // Anti-enumeration: a missing token, an already-consumed token, and
        // a token tied to a non-REJECTED user all collapse to the same
        // generic failure. An attacker can't probe whether a given token
        // string was ever issued.
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid or expired re-verification token');
    }
    if (!((_a = dbUser.reverification) === null || _a === void 0 ? void 0 : _a.expireAt) ||
        dbUser.reverification.expireAt.getTime() <= Date.now()) {
        // Wipe the stale token so a future request can re-issue without
        // colliding.
        yield user_model_1.User.findByIdAndUpdate(dbUser._id, {
            $set: { reverification: { token: null, expireAt: null } },
        });
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid or expired re-verification token');
    }
    // Unlink the old verification files before overwriting. Best-effort —
    if (profileImage && dbUser.profileImage)
        (0, unlinkFile_1.default)(dbUser.profileImage);
    const update = {
        status: user_1.USER_STATUS.PENDING,
        isVerified: false,
        reverification: { token: null, expireAt: null },
        rejectionReason: null,
    };
    if (profileImage) {
        update.profileImage = profileImage;
    }
    yield user_model_1.User.findByIdAndUpdate(dbUser._id, { $set: update });
    return {
        email: dbUser.email,
        status: user_1.USER_STATUS.PENDING,
    };
});
const listMySessionsFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = user;
    const dbUser = yield user_model_1.User.findById(id).select('deviceTokens').lean();
    if (!dbUser) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    const sessions = ((_a = dbUser.deviceTokens) !== null && _a !== void 0 ? _a : []).map((dt) => {
        var _a, _b, _c, _d;
        return ({
            tokenId: dt._id ? dt._id.toString() : null,
            // `tokenPrefix` is "…XYZA12" — last 6 chars of the raw push token.
            // Lets the user identify "the device whose token ends in XYZA12"
            // in the sessions UI without ever exposing the full credential.
            // Legacy rows (pre-T1-4) have no prefix; show null so the UI can
            // render a fallback like "Device".
            tokenPrefix: (_a = dt.tokenPrefix) !== null && _a !== void 0 ? _a : null,
            platform: (_b = dt.platform) !== null && _b !== void 0 ? _b : null,
            appVersion: (_c = dt.appVersion) !== null && _c !== void 0 ? _c : null,
            lastSeenAt: (_d = dt.lastSeenAt) !== null && _d !== void 0 ? _d : null,
        });
    });
    return { sessions };
});
const revokeMySessionFromDB = (user, tokenId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = user;
    // $pull by the subdoc _id. Mongoose will silently no-op if the id
    // doesn't match any element — we follow up with a modifiedCount check
    // so the caller gets a clean 404 instead of a confusing 200.
    const result = yield user_model_1.User.findByIdAndUpdate(id, { $pull: { deviceTokens: { _id: new mongoose_1.Types.ObjectId(tokenId) } } }, { new: true }).select('deviceTokens');
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    // If the token was actually removed, the array length must have
    // decreased. We don't have the previous length here, so the safer
    // check is whether the `_id` still appears in the updated array.
    const stillPresent = ((_a = result.deviceTokens) !== null && _a !== void 0 ? _a : []).some((dt) => dt._id && dt._id.toString() === tokenId);
    if (stillPresent) {
        // Should never happen — $pull either removed it or never matched.
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Session not found');
    }
    // We don't bump tokenVersion here — that would invalidate every
    // session, not just this one. Revoking a device only stops push
    // delivery; the JWT remains valid until natural expiry (short-lived).
    return { tokenId };
});
const revokeAllMySessionsFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = user;
    // Clear every device token AND bump tokenVersion. This is the only
    // place outside password reset/change where tokenVersion is bumped
    // by the user themselves — see system-concepts.md → "Token-Version
    // Invalidation Policy" for the policy entry.
    const result = yield user_model_1.User.findByIdAndUpdate(id, {
        $set: { deviceTokens: [] },
        $inc: { tokenVersion: 1 },
    }, { new: true });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    return { revokedAt: new Date().toISOString() };
});
const exportMyDataFromDB = (user) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = user;
    const profile = yield user_model_1.User.findById(id)
        .select('-password -authentication -emailChange -tokenVersion -deletedAt')
        .lean();
    if (!profile) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, "User doesn't exist!");
    }
    // Sanitize deviceTokens — return display metadata only. Strip both
    // the legacy raw `token` field AND the HMAC `tokenHash` (the hash by
    // itself doesn't enable impersonation, but combined with the JWT
    // secret could verify ownership of a leaked raw token). `tokenPrefix`
    // is safe to expose — 6 suffix chars only.
    const deviceTokens = ((_a = profile.deviceTokens) !== null && _a !== void 0 ? _a : []).map((dt) => {
        var _a, _b, _c, _d;
        return ({
            tokenPrefix: (_a = dt.tokenPrefix) !== null && _a !== void 0 ? _a : null,
            platform: (_b = dt.platform) !== null && _b !== void 0 ? _b : null,
            appVersion: (_c = dt.appVersion) !== null && _c !== void 0 ? _c : null,
            lastSeenAt: (_d = dt.lastSeenAt) !== null && _d !== void 0 ? _d : null,
        });
    });
    profile.deviceTokens = deviceTokens;
    // Fan-out: each collection that references this user.
    const [notifications, supportTickets, subscriptions, subscriptionEvents,] = yield Promise.all([
        notification_model_1.Notification.find({ receiver: id }).lean(),
        support_ticket_model_1.SupportTicket.find({ userId: id }).lean(),
        subscription_model_1.Subscription.find({ userId: id }).lean(),
        subscription_event_model_1.SubscriptionEvent.find({ userId: id }).lean(),
    ]);
    const payload = {
        exportedAt: new Date().toISOString(),
        schemaVersion: 1,
        profile,
        notifications,
        supportTickets,
        subscriptions: {
            current: subscriptions,
            events: subscriptionEvents,
        },
    };
    // Size guard. Synchronous JSON export only stays safe under ~5 MB —
    // beyond that, mobile clients hit body-size limits and the response
    // can time out. When we exceed it, refuse with a clear message so the
    // client knows to wait for the future async-delivery variant rather
    // than mistaking it for a generic 5xx.
    const SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
    const sizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    if (sizeBytes > SIZE_LIMIT_BYTES) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.REQUEST_TOO_LONG, `Export payload exceeds the synchronous size limit (${(sizeBytes / 1024 / 1024).toFixed(1)} MB > 5 MB). An async email-link variant is planned; until then, contact support to receive a copy of your data.`);
    }
    return payload;
});
const bulkDeleteUsersFromDB = (userIds) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_model_1.User.deleteMany({ _id: { $in: userIds } });
    return result;
});
const exportUsersFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { data } = yield getAllUserRolesFromDB(Object.assign(Object.assign({}, query), { limit: 100000 })); // Large limit for export
    return data;
});
exports.UserService = {
    bulkDeleteUsersFromDB,
    exportUsersFromDB,
    createUserToDB,
    getUserProfileFromDB,
    updateProfileToDB,
    getAllUsersFromDB,
    getAllUserRolesFromDB,
    updateUserStatusInDB,
    updateUserByAdminInDB,
    deleteUserPermanentlyFromDB,
    getUserByIdFromDB,
    getUserDetailsByIdFromDB,
    getUserMetricsFromDB,
    requestAccountDeletionFromDB,
    requestEmailChangeFromDB,
    confirmEmailChangeFromDB,
    exportMyDataFromDB,
    listMySessionsFromDB,
    revokeMySessionFromDB,
    revokeAllMySessionsFromDB,
    reverifyAccountFromDB,
    getUserProfilesFromDB,
};
