import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { USER_STATUS, USER_ROLES } from '../../../enums/user';
import { PipelineStage, Types } from 'mongoose';
import { Subscription as SubscriptionModel } from '../subscription/subscription.model';
import ApiError from '../../../errors/ApiError';
import { emailHelper } from '../../../helpers/emailHelper';
import { emailTemplate } from '../../../shared/emailTemplate';
import { sendVerificationOTP } from '../../../helpers/authHelpers';
import unlinkFile from '../../../shared/unlinkFile';
import generateOTP from '../../../util/generateOTP';
import { User } from './user.model';
import QueryBuilder from '../../builder/QueryBuilder';
import AggregationBuilder from '../../builder/AggregationBuilder';
import { IUser } from './user.interface';
import {
  OTP_TTL_MS,
  REVERIFY_TOKEN_TTL_MS,
  REVERIFY_TOKEN_TTL_HOURS,
} from '../../../config/auth.constants';
import cryptoToken from '../../../util/cryptoToken';

import mongoose from 'mongoose';

const createUserToDB = async (
  payload: Partial<IUser>,
  isAdmin = false
): Promise<IUser> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 1. Email Uniqueness Check (409 Conflict)
    const existingUser = await User.findOne({ email: payload.email }).session(session);
    if (existingUser) {
      if (existingUser.isVerified) {
        throw new ApiError(StatusCodes.CONFLICT, 'Email already registered');
      } else {
        // Handle pending account: If created < 24h, block. If > 24h, delete and recreate.
        const dayInMs = 24 * 60 * 60 * 1000;
        const isRecent = Date.now() - new Date(existingUser.createdAt).getTime() < dayInMs;
        if (isRecent) {
          throw new ApiError(StatusCodes.CONFLICT, 'Email already registered and pending verification');
        } else {
          await User.findByIdAndDelete(existingUser._id).session(session);
        }
      }
    }

    // 2. Prepare User Data
    const userData = {
      ...payload,
      isVerified: isAdmin ? true : false,
      status: isAdmin ? USER_STATUS.ACTIVE : USER_STATUS.PENDING,
    };

    // 3. Create User
    const [createUser] = await User.create([userData], { session });
    if (!createUser) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Failed to create user');
    }

    // 4. Send Verification OTP (Only for public registration)
    if (!isAdmin) {
      // Note: sendVerificationOTP must also support session if it writes to DB
      await sendVerificationOTP(createUser.email, session);
    }

    await session.commitTransaction();
    return createUser;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const getUserProfileFromDB = async (
  user: JwtPayload,
): Promise<Partial<IUser>> => {
  const { id } = user;
  const isExistUser = await User.findById(id)
    .select('-password -authentication -tokenVersion -deviceTokens -deletedAt')
    .lean();
    
  if (!isExistUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  // Flatten location for consistency with list API
  if (isExistUser.location) {
    (isExistUser as any).country = isExistUser.location.country;
    (isExistUser as any).city = isExistUser.location.city;
    if (isExistUser.location.coordinates) {
      (isExistUser as any).latitude = isExistUser.location.coordinates[1];
      (isExistUser as any).longitude = isExistUser.location.coordinates[0];
    }
    delete isExistUser.location;
  }

  return isExistUser as Partial<IUser>;
};

const updateProfileToDB = async (
  user: JwtPayload,
  payload: Partial<IUser>,
): Promise<Partial<IUser | null>> => {
  const { id } = user;
  const isExistUser = await User.isExistUserById(id);
  if (!isExistUser) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  // //unlink file here
  // if (payload.image) {
  //   unlinkFile(isExistUser.image);
  // }

  //unlink file here
  if (payload.profileImage) {
    unlinkFile(isExistUser.profileImage);
  }

  // Transform legacy location format {latitude, longitude} to GeoJSON [longitude, latitude]
  if (payload.location) {
    const { latitude, longitude, ...remainingLocation } = payload.location as any;
    if (latitude !== undefined && longitude !== undefined) {
      payload.location = {
        ...remainingLocation,
        type: 'Point',
        coordinates: [longitude, latitude],
      } as any;
    }
  }

  const updateDoc = await User.findOneAndUpdate({ _id: id }, payload, {
    new: true,
  });

  return updateDoc;
};

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find(), query)
    .search(['name', 'email'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const users = await userQuery.modelQuery;
  const paginationInfo = await userQuery.getPaginationInfo();

  return {
    meta: paginationInfo,
    data: users,
  };
};

const getUserMetricsFromDB = async () => {
  const aggregationBuilder = new AggregationBuilder(User);
  const excludeAdminFilter = { role: { $ne: USER_ROLES.SUPER_ADMIN } };
  
  // Overall user growth (excluding SUPER_ADMIN)
  const totalStats = await aggregationBuilder.calculateGrowth({ 
    filter: excludeAdminFilter,
    period: 'month' 
  });
  
  // Status based growth (excluding SUPER_ADMIN)
  aggregationBuilder.reset();
  const activeStats = await aggregationBuilder.calculateGrowth({ 
    filter: { ...excludeAdminFilter, status: USER_STATUS.ACTIVE }, 
    period: 'month' 
  });
  
  aggregationBuilder.reset();
  const pendingStats = await aggregationBuilder.calculateGrowth({ 
    filter: { ...excludeAdminFilter, status: USER_STATUS.PENDING }, 
    period: 'month' 
  });
  
  aggregationBuilder.reset();
  const suspendedStats = await aggregationBuilder.calculateGrowth({ 
    filter: { ...excludeAdminFilter, status: USER_STATUS.SUSPENDED }, 
    period: 'month' 
  });

  const formatMetric = (stat: any) => ({
    value: stat.total,
    changePct: stat.growth,
    direction: stat.growthType === 'increase' ? 'up' : stat.growthType === 'decrease' ? 'down' : 'neutral',
  });

  return {
    meta: {
      comparisonPeriod: 'month',
    },
    totalUsers: formatMetric(totalStats),
    activeUsers: formatMetric(activeStats),
    pendingUsers: formatMetric(pendingStats),
    suspendedUsers: formatMetric(suspendedStats),
  };
};

const getAllUserRolesFromDB = async (query: Record<string, unknown>) => {
  const { searchTerm, email, role, status, isVerified, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  
  const skip = (Number(page) - 1) * Number(limit);

  const match: Record<string, any> = {
    role: { $ne: USER_ROLES.SUPER_ADMIN },
  };
  if (status) match.status = status;
  if (isVerified !== undefined) match.isVerified = isVerified === 'true' ? true : isVerified === 'false' ? false : isVerified;
  if (role) match.role = role;
  if (email) match.email = { $regex: email, $options: 'i' };
  if (searchTerm) {
    match.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  const basePipeline: PipelineStage[] = [
    { $match: match },
    {
      $project:
        status === USER_STATUS.PENDING
          ? {
              _id: 1,
              name: 1,
              email: 1,
              role: 1,
              verificationImage: 1,
              verificationVideo: 1,
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
              createdAt: 1,
              updatedAt: 1,
            },
    },
  ];

  const sortStage: PipelineStage = {
    $sort: { [sortBy as string]: sortOrder === -1 ? -1 : 1 },
  };

  const paginatedPipeline: PipelineStage[] = [
    ...basePipeline,
    sortStage,
    { $skip: skip },
    { $limit: Number(limit) },
  ];

  const countPipeline: PipelineStage[] = [
    ...basePipeline,
    { $count: 'total' },
  ];

  const [data, countResult] = await Promise.all([
    User.aggregate(paginatedPipeline),
    User.aggregate(countPipeline),
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
};

const getUserProfilesFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const { 
    searchTerm, 
    limit: rawLimit = 10, 
    nextCursor,
    latitude, 
    longitude,
    filter, // 'new-reverts' or 'nearby-me'
  } = query;

  const limit = Math.min(Number(rawLimit) || 10, 50);

  // Enforce same-role discovery and ACTIVE status only
  const match: Record<string, any> = {
    role: user.role,
    status: USER_STATUS.ACTIVE,
    _id: { $ne: new Types.ObjectId(user.id) }, // Exclude self
    deletedAt: { $exists: false }
  };

  if (searchTerm) {
    match.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  // Cursor-based pagination: decode cursor and add _id filter
  if (nextCursor && typeof nextCursor === 'string') {
    let decodedCursorValue: string = nextCursor;
    try {
      decodedCursorValue = Buffer.from(nextCursor, 'base64').toString('ascii');
    } catch (e) {
      // Fallback if not valid base64
    }

    if (Types.ObjectId.isValid(decodedCursorValue)) {
      // Default sort is descending (newest first), so we need $lt for next page
      match._id = { ...match._id, $lt: new Types.ObjectId(decodedCursorValue) };
    }
  }

  const pipeline: PipelineStage[] = [];

  // 1. Proximity Search & Sorting Logic
  if (latitude && longitude) {
    const userLat = parseFloat(latitude as string);
    const userLng = parseFloat(longitude as string);

    if (!isNaN(userLat) && !isNaN(userLng)) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [userLng, userLat] },
          distanceField: 'distanceInKm',
          spherical: true,
          distanceMultiplier: 0.001, // Convert meters to km
          query: match,
        },
      });

      // If NOT explicitly nearby-me, sort by createdAt but keep distanceInKm
      if (filter !== 'nearby-me') {
        pipeline.push({ $sort: { createdAt: -1 } });
      }
    } else {
      pipeline.push({ $match: match });
      pipeline.push({ $sort: { _id: -1 as const } });
    }
  } else {
    pipeline.push({ $match: match });
    pipeline.push({ $sort: { _id: -1 as const } });
  }

  // 2. Projection & Derived Fields
  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      profileImage: 1,
      revertDate: 1,
      distanceInKm: 1,
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

  const result = await User.aggregate(pipeline);

  const hasNext = result.length > limit;
  const data = hasNext ? result.slice(0, limit) : result;

  let newCursor: string | null = null;
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
};

const getUserByIdFromDB = async (id: string, requester: JwtPayload): Promise<Partial<IUser> | null> => {
  const user = await User.findById(id).select(
    '-password -authentication -tokenVersion -deviceTokens -deletedAt',
  ).lean();

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  // Admin specific view: can see all fields except excluded ones above
  // Flatten location for consistency with other profile APIs
  if (user.location) {
    (user as any).country = user.location.country;
    (user as any).city = user.location.city;
    if (user.location.coordinates) {
      (user as any).latitude = user.location.coordinates[1];
      (user as any).longitude = user.location.coordinates[0];
    }
    delete user.location;
  }

  return user as Partial<IUser>;
};

// Statuses that should make every live JWT for the user stop working
// immediately. We bump `tokenVersion` on flips INTO these so a stolen or
// in-flight token can't keep being used after the admin acts.
const SESSION_INVALIDATING_STATUSES: USER_STATUS[] = [
  USER_STATUS.SUSPENDED,
  USER_STATUS.RESTRICTED,
  USER_STATUS.DELETED,
  USER_STATUS.REJECTED,
  USER_STATUS.INACTIVE,
];

const updateUserStatusInDB = async (id: string, status: USER_STATUS, reason?: string) => {
  const user = await User.findById(id).select('+authentication'); // Need authentication for isVerified check
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  // Safety checks for "Review" transitions (Reviewing from PENDING to ACTIVE/REJECTED)
  const isReviewProcess = (status === USER_STATUS.ACTIVE || status === USER_STATUS.REJECTED) && user.status === USER_STATUS.PENDING;
  
  if (isReviewProcess) {
    if (!user.isVerified) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'User must verify OTP before admin approval');
    }
  }

  // Detect the REJECTED transition. When an admin flips a user to
  // REJECTED, we (a) issue a one-time re-verification token,
  // (b) persist it on the user with a 24h expiry, and (c) email it to
  // the user so they can re-submit their docs via the public
  // POST /users/reverify endpoint. The user cannot log in in this
  // state (auth middleware blocks REJECTED), so a token-based public
  // flow is the only recovery path.
  const flippingToRejected =
    status === USER_STATUS.REJECTED && user.status !== USER_STATUS.REJECTED;

  // Detect any flip INTO a session-invalidating status. The auth
  // middleware already 403s these users on the next request because
  // of the status check — bumping tokenVersion is defense-in-depth so
  // a token in flight at the moment of the admin action is also dead.
  const flippingToLockout =
    SESSION_INVALIDATING_STATUSES.includes(status) && user.status !== status;

  const update: Record<string, unknown> = { status };
  if (reason) {
    update.rejectionReason = reason;
  }

  let reverifyToken: string | null = null;
  if (flippingToRejected) {
    reverifyToken = cryptoToken();
    update.reverification = {
      token: reverifyToken,
      expireAt: new Date(Date.now() + REVERIFY_TOKEN_TTL_MS),
    };
  }

  const dbUpdate: Record<string, unknown> = { $set: update };
  if (flippingToLockout) {
    dbUpdate.$inc = { tokenVersion: 1 };
  }

  const updatedUser = await User.findByIdAndUpdate(id, dbUpdate, { new: true });

  if (flippingToRejected && reverifyToken && updatedUser) {
    await emailHelper.enqueue(
      emailTemplate.accountRejected({
        email: updatedUser.email,
        name: updatedUser.name,
        reverifyToken,
        reverifyTtlHours: REVERIFY_TOKEN_TTL_HOURS,
        rejectionReason: (updatedUser as any).rejectionReason,
      }),
      { kind: 'account_rejected_reverify' },
    );
  }

  return updatedUser;
};

const deleteUserPermanentlyFromDB = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const deletedUser = await User.findByIdAndDelete(id)
    .select('-password -authentication');
  return deletedUser;
};

const updateUserByAdminInDB = async (id: string, payload: Partial<IUser>) => {
  // Pull tokenVersion so we can bump it locally on lockout transitions.
  // password stays selected for the schema's bcrypt pre-save hook.
  const user = await User.findById(id).select('+password +tokenVersion');
  if (!user) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "User doesn't exist!");
  }

  const previousStatus = user.status;

  // Email uniqueness — admin can change a user's email, but the change
  // must not collide with another active account. Without this check the
  // model's unique index trips an E11000 at .save() that surfaces as a
  // confusing 500 instead of the documented 409.
  if (payload.email !== undefined && payload.email !== user.email) {
    const taken = await User.findOne({
      email: payload.email,
      _id: { $ne: user._id },
      status: { $ne: USER_STATUS.DELETED },
    }).lean();
    if (taken) {
      throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
    }
  }

  // Whitelist fields admin can update (excluding password/auth info)
  if (payload.name !== undefined) (user as any).name = payload.name;
  if (payload.aboutMe !== undefined) (user as any).aboutMe = payload.aboutMe;
  if (payload.revertStory !== undefined) (user as any).revertStory = payload.revertStory;
  if (payload.interests !== undefined) (user as any).interests = payload.interests;
  if (payload.email !== undefined) (user as any).email = payload.email;
  if (payload.dateOfBirth !== undefined) (user as any).dateOfBirth = payload.dateOfBirth;
  if (payload.revertDate !== undefined) (user as any).revertDate = payload.revertDate;
  
  if (payload.location !== undefined) {
    const { latitude, longitude, ...remainingLocation } = payload.location as any;
    if (latitude !== undefined && longitude !== undefined) {
      (user as any).location = {
        ...remainingLocation,
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    } else {
      (user as any).location = payload.location;
    }
  }

  // if (payload.gender !== undefined) (user as any).gender = payload.gender;
  if (payload.profileImage !== undefined) (user as any).profileImage = payload.profileImage;
  if (payload.status !== undefined) (user as any).status = payload.status;
  if (payload.role !== undefined) (user as any).role = payload.role;
  if (payload.rejectionReason !== undefined) (user as any).rejectionReason = payload.rejectionReason;

  // Status-change side effects — must stay in sync with updateUserStatusInDB
  // because this endpoint is the "combined" admin update that can also flip
  // status. Without this hook, an admin who flips status via this route
  // bypasses both the reverify-token email and the tokenVersion bump.
  const newStatus = (user as any).status as USER_STATUS;
  const statusChanged =
    payload.status !== undefined && newStatus !== previousStatus;

  const flippingToRejected =
    statusChanged && newStatus === USER_STATUS.REJECTED;
  const flippingToLockout =
    statusChanged && SESSION_INVALIDATING_STATUSES.includes(newStatus);

  let reverifyToken: string | null = null;
  if (flippingToRejected) {
    reverifyToken = cryptoToken();
    (user as any).reverification = {
      token: reverifyToken,
      expireAt: new Date(Date.now() + REVERIFY_TOKEN_TTL_MS),
    };
  }

  if (flippingToLockout) {
    (user as any).tokenVersion = ((user as any).tokenVersion ?? 0) + 1;
  }

  await user.save();

  if (flippingToRejected && reverifyToken) {
    await emailHelper.enqueue(
      emailTemplate.accountRejected({
        email: user.email,
        name: user.name,
        reverifyToken,
        reverifyTtlHours: REVERIFY_TOKEN_TTL_HOURS,
        rejectionReason: (user as any).rejectionReason,
      }),
      { kind: 'account_rejected_reverify' },
    );
  }

  const plain = user.toObject();
  delete (plain as any).password;
  delete (plain as any).authentication;
  delete (plain as any).tokenVersion;
  delete (plain as any).reverification;
  return plain as IUser;
};

const getUserDetailsByIdFromDB = async (id: string, requester: JwtPayload) => {
  const user = await User.findById(id).select(
    '_id name role profileImage location isVerified revertDate aboutMe revertStory interests createdAt status deletedAt'
  );

  // 1. Check existence and visibility
  if (!user || user.status !== USER_STATUS.ACTIVE || user.deletedAt) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  // 2. Role-based privacy: BROTHER sees BROTHER, SISTER sees SISTER
  const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
  if (!isSuperAdmin && requester.role !== user.role) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      "You don't have permission to view this profile"
    );
  }

  // Convert to object and return
  const result = user.toObject();
  
  // Flatten location for convenience if needed, or keep as is
  if (result.location) {
    (result as any).country = result.location.country;
    (result as any).city = result.location.city;
    if (result.location.coordinates) {
      (result as any).latitude = result.location.coordinates[1];
      (result as any).longitude = result.location.coordinates[0];
    }
    delete result.location;
  }

  // Final cleanup of internal status/flags
  delete (result as any).status;
  delete (result as any).deletedAt;



  return result;
};

const SOFT_DELETE_RECOVERY_DAYS = 30;

const requestAccountDeletionFromDB = async (
  user: JwtPayload,
  password: string,
) => {
  const { id } = user;

  // Pull password + tokenVersion explicitly — both are select: false on the schema.
  const dbUser = await User.findById(id).select('+password +tokenVersion');
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  if (dbUser.status === USER_STATUS.DELETED) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Account is already scheduled for deletion',
    );
  }

  // Defense-in-depth: stolen token alone must not be enough to wipe an account.
  if (!dbUser.password) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Password-less accounts (Google/Apple) cannot be deleted via this endpoint yet',
    );
  }

  const passwordOk = await User.isMatchPassword(password, dbUser.password);
  if (!passwordOk) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Incorrect password');
  }

  const now = new Date();
  const recoveryDeadline = new Date(
    now.getTime() + SOFT_DELETE_RECOVERY_DAYS * 24 * 60 * 60 * 1000,
  );

  // Bumping tokenVersion immediately invalidates every JWT this user holds.
  await User.findByIdAndUpdate(id, {
    $set: {
      status: USER_STATUS.DELETED,
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
};

const requestEmailChangeFromDB = async (
  user: JwtPayload,
  payload: { newEmail: string; password: string },
) => {
  const { id } = user;
  const { newEmail, password } = payload;

  // Pull password explicitly — select: false on the schema.
  const dbUser = await User.findById(id).select('+password');
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  if (!dbUser.password) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Password-less accounts (Google/Apple) cannot change email via this endpoint yet',
    );
  }

  const passwordOk = await User.isMatchPassword(password, dbUser.password);
  if (!passwordOk) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Incorrect password');
  }

  // Reject no-op changes early so the user gets a clear message instead of
  // silently consuming an OTP slot.
  if (dbUser.email === newEmail) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'New email is the same as the current email',
    );
  }

  // Uniqueness — exclude soft-deleted users so a recoverable account doesn't
  // permanently block its own email.
  const taken = await User.findOne({
    email: newEmail,
    _id: { $ne: dbUser._id },
    status: { $ne: USER_STATUS.DELETED },
  }).lean();
  if (taken) {
    throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
  }

  const otp = generateOTP();
  const expireAt = new Date(Date.now() + OTP_TTL_MS);

  await User.findByIdAndUpdate(id, {
    $set: {
      emailChange: { newEmail, otp, expireAt },
    },
  });

  // OTP to the NEW email — proves the user controls that inbox.
  await emailHelper.enqueue(
    emailTemplate.changeEmail({ newEmail, otp }),
    { kind: 'email_change_otp' },
  );
  // Heads-up to the OLD email — catches takeover attempts where the
  // attacker has the password but not the original inbox.
  await emailHelper.enqueue(
    emailTemplate.emailChangeNotification({
      oldEmail: dbUser.email,
      newEmail,
    }),
    { kind: 'email_change_notification' },
  );

  return {
    newEmail,
    expireAt: expireAt.toISOString(),
    otpTtlSeconds: OTP_TTL_MS / 1000,
  };
};

const confirmEmailChangeFromDB = async (
  user: JwtPayload,
  otp: string,
) => {
  const { id } = user;

  // Pull emailChange + tokenVersion explicitly — both are select: false.
  const dbUser = await User.findById(id).select('+emailChange +tokenVersion');
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const pending = dbUser.emailChange;
  if (!pending || !pending.newEmail || !pending.otp || !pending.expireAt) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'No pending email-change request',
    );
  }

  if (pending.expireAt.getTime() <= Date.now()) {
    // Clear the stale request so a fresh one can replace it.
    await User.findByIdAndUpdate(id, {
      $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
    });
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP has expired');
  }

  if (pending.otp !== otp) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid OTP');
  }

  // Re-check uniqueness at commit time — someone else may have grabbed the
  // address while this OTP was outstanding.
  const taken = await User.findOne({
    email: pending.newEmail,
    _id: { $ne: dbUser._id },
    status: { $ne: USER_STATUS.DELETED },
  }).lean();
  if (taken) {
    await User.findByIdAndUpdate(id, {
      $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
    });
    throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
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
    await User.findByIdAndUpdate(id, {
      $set: {
        email: pending.newEmail,
        emailChange: { newEmail: null, otp: null, expireAt: null },
      },
      $inc: { tokenVersion: 1 },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Mongo unique-key violation — another user already owns the
      // address. Clear the pending request so the user can start over.
      await User.findByIdAndUpdate(id, {
        $set: { emailChange: { newEmail: null, otp: null, expireAt: null } },
      });
      throw new ApiError(StatusCodes.CONFLICT, 'This email is already in use');
    }
    throw err;
  }

  return {
    email: pending.newEmail,
  };
};

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
const reverifyAccountFromDB = async (payload: {
  token: string;
  verificationImage: string;
  verificationVideo: string;
  profileImage?: string;
}) => {
  const { token, verificationImage, verificationVideo, profileImage } = payload;

  const dbUser = await User.findOne({
    'reverification.token': token,
    status: USER_STATUS.REJECTED,
  }).select('+reverification');

  if (!dbUser) {
    // Anti-enumeration: a missing token, an already-consumed token, and
    // a token tied to a non-REJECTED user all collapse to the same
    // generic failure. An attacker can't probe whether a given token
    // string was ever issued.
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid or expired re-verification token',
    );
  }

  if (
    !dbUser.reverification?.expireAt ||
    dbUser.reverification.expireAt.getTime() <= Date.now()
  ) {
    // Wipe the stale token so a future request can re-issue without
    // colliding.
    await User.findByIdAndUpdate(dbUser._id, {
      $set: { reverification: { token: null, expireAt: null } },
    });
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Invalid or expired re-verification token',
    );
  }

  // Unlink the old verification files before overwriting. Best-effort —
  // an unlink failure on a missing file shouldn't block re-verification.
  if (dbUser.verificationImage) unlinkFile(dbUser.verificationImage);
  if (dbUser.verificationVideo) unlinkFile(dbUser.verificationVideo);
  if (profileImage && dbUser.profileImage) unlinkFile(dbUser.profileImage);

  const update: Record<string, unknown> = {
    status: USER_STATUS.PENDING,
    isVerified: false,
    verificationImage,
    verificationVideo,
    reverification: { token: null, expireAt: null },
    rejectionReason: null,
  };
  if (profileImage) {
    update.profileImage = profileImage;
  }

  await User.findByIdAndUpdate(dbUser._id, { $set: update });

  return {
    email: dbUser.email,
    status: USER_STATUS.PENDING,
  };
};

const listMySessionsFromDB = async (user: JwtPayload) => {
  const { id } = user;
  const dbUser = await User.findById(id).select('deviceTokens').lean();
  if (!dbUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  const sessions = (dbUser.deviceTokens ?? []).map((dt: any) => ({
    tokenId: dt._id ? dt._id.toString() : null,
    // `tokenPrefix` is "…XYZA12" — last 6 chars of the raw push token.
    // Lets the user identify "the device whose token ends in XYZA12"
    // in the sessions UI without ever exposing the full credential.
    // Legacy rows (pre-T1-4) have no prefix; show null so the UI can
    // render a fallback like "Device".
    tokenPrefix: dt.tokenPrefix ?? null,
    platform: dt.platform ?? null,
    appVersion: dt.appVersion ?? null,
    lastSeenAt: dt.lastSeenAt ?? null,
  }));

  return { sessions };
};

const revokeMySessionFromDB = async (user: JwtPayload, tokenId: string) => {
  const { id } = user;

  // $pull by the subdoc _id. Mongoose will silently no-op if the id
  // doesn't match any element — we follow up with a modifiedCount check
  // so the caller gets a clean 404 instead of a confusing 200.
  const result = await User.findByIdAndUpdate(
    id,
    { $pull: { deviceTokens: { _id: new Types.ObjectId(tokenId) } } },
    { new: true },
  ).select('deviceTokens');

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  // If the token was actually removed, the array length must have
  // decreased. We don't have the previous length here, so the safer
  // check is whether the `_id` still appears in the updated array.
  const stillPresent = (result.deviceTokens ?? []).some(
    (dt: any) => dt._id && dt._id.toString() === tokenId,
  );
  if (stillPresent) {
    // Should never happen — $pull either removed it or never matched.
    throw new ApiError(StatusCodes.NOT_FOUND, 'Session not found');
  }

  // We don't bump tokenVersion here — that would invalidate every
  // session, not just this one. Revoking a device only stops push
  // delivery; the JWT remains valid until natural expiry (short-lived).
  return { tokenId };
};

const revokeAllMySessionsFromDB = async (user: JwtPayload) => {
  const { id } = user;

  // Clear every device token AND bump tokenVersion. This is the only
  // place outside password reset/change where tokenVersion is bumped
  // by the user themselves — see system-concepts.md → "Token-Version
  // Invalidation Policy" for the policy entry.
  const result = await User.findByIdAndUpdate(
    id,
    {
      $set: { deviceTokens: [] },
      $inc: { tokenVersion: 1 },
    },
    { new: true },
  );

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  return { revokedAt: new Date().toISOString() };
};

const exportMyDataFromDB = async (user: JwtPayload) => {
  const profile = await User.findById(id)
    .select(
      '-password -authentication -emailChange -tokenVersion -deletedAt',
    )
    .lean();

  if (!profile) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User doesn't exist!");
  }

  // Sanitize deviceTokens — return display metadata only. Strip both
  // the legacy raw `token` field AND the HMAC `tokenHash` (the hash by
  // itself doesn't enable impersonation, but combined with the JWT
  // secret could verify ownership of a leaked raw token). `tokenPrefix`
  // is safe to expose — 6 suffix chars only.
  const deviceTokens = (profile.deviceTokens ?? []).map((dt: any) => ({
    tokenPrefix: dt.tokenPrefix ?? null,
    platform: dt.platform ?? null,
    appVersion: dt.appVersion ?? null,
    lastSeenAt: dt.lastSeenAt ?? null,
  }));
  (profile as any).deviceTokens = deviceTokens;

  // Fan-out: each collection that references this user.
  const [
    notifications,
    groupMemberships,
    groupPosts,
    postLikes,
    postComments,
    askQuestionData,
    subscriptions,
    subscriptionEvents,
  ] = await Promise.all([
    Notification.find({ userId: id }).lean(),
    GroupMember.find({ userId: id }).lean(),
    GroupPost.find({ userId: id }).lean(),
    PostLike.find({ userId: id }).lean(),
    PostComment.find({ userId: id }).lean(),
    AskQuestion.find({ userId: id }).lean(),
    Subscription.find({ userId: id }).lean(),
    SubscriptionEvent.find({ userId: id }).lean(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    profile,
    notifications,
    groupActivity: {
      memberships: groupMemberships,
      posts: groupPosts,
      likes: postLikes,
      comments: postComments,
    },
    askQuestionData,
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
    throw new ApiError(
      StatusCodes.REQUEST_TOO_LONG,
      `Export payload exceeds the synchronous size limit (${(sizeBytes / 1024 / 1024).toFixed(1)} MB > 5 MB). An async email-link variant is planned; until then, contact support to receive a copy of your data.`,
    );
  }

  return payload;
};

const bulkDeleteUsersFromDB = async (userIds: string[]) => {
  const result = await User.deleteMany({ _id: { $in: userIds } });
  return result;
};

const exportUsersFromDB = async (query: Record<string, unknown>) => {
  const { data } = await getAllUserRolesFromDB({ ...query, limit: 100000 }); // Large limit for export
  return data;
};
export const UserService = {
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
