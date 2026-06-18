import { ExportBuilder } from '../../builder';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { UserService } from './user.service';
import { USER_STATUS, USER_ROLES } from '../../../enums/user';
import { JwtPayload, Secret } from 'jsonwebtoken';
import { jwtHelper } from '../../../helpers/jwtHelper';
import config from '../../../config';

const createUser = catchAsync(async (req: Request, res: Response) => {
  const { profileImage, ...userData } = req.body;

  // Handle files if uploaded
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['profileImage']) {
      userData.profileImage = (files['profileImage'][0] as any).location || files['profileImage'][0].path;
    }
  }

  // Extract guestId from headers
  const guestId = req.headers['x-guest-id'] as string | undefined;

  // Check if requester is an admin (optional auth for this specific endpoint)
  let isAdmin = false;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const verifiedUser = jwtHelper.verifyToken(
        token,
        config.jwt.jwt_secret as Secret
      );
      if (
        verifiedUser &&
        verifiedUser.role === USER_ROLES.SUPER_ADMIN
      ) {
        isAdmin = true;
      }
    } catch (err) {
      // Ignore token errors; fallback to public registration flow
    }
  }

  const result = await UserService.createUserToDB(
    {
      ...userData,
      profileImage: userData.profileImage || profileImage,
    },
    isAdmin,
    guestId
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'User created successfully. Please verify your email with the OTP sent.',
    data: {
      email: result.email,
      isVerified: result.isVerified,
      status: result.status,
    },
  });
});

const getUserProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await UserService.getUserProfileFromDB(user as JwtPayload);

  // Private payload (email, dateOfBirth, verification artefacts). Forbid
  // any shared cache and disable disk persistence. Clients may still keep
  // an in-memory copy for the session.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile data retrieved successfully',
    data: result,
  });
});



const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const payload = { ...req.body };

  // Handle file if uploaded
  if (req.file) {
    let filePath = (req.file as any).location || req.file.path;
    // If it's a local path, convert it to a relative URL for the frontend
    if (!filePath.startsWith('http')) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const uploadIndex = normalizedPath.indexOf('/uploads/');
      if (uploadIndex !== -1) {
        filePath = normalizedPath.substring(uploadIndex);
      } else {
        // Fallback if /uploads/ is not found
        filePath = '/' + req.file.path.replace(/\\/g, '/');
      }
    }
    payload.profileImage = filePath;
  }

  const result = await UserService.updateProfileToDB(
    user as JwtPayload,
    payload,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Profile updated successfully',
    data: {
      id: (result as any)?._id,
      ...payload,
      updatedAt: result?.updatedAt,
    },
  });
});

const updateUserReview = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { status } = req.body as { status: USER_STATUS };

  const result = await UserService.updateUserStatusInDB(userId, status);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User review status updated',
    data: {
      id: result?._id,
      status: result?.status,
      updatedAt: result?.updatedAt,
    },
  });
});

const adminUpdateUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const payload = { ...req.body };
  const result = await UserService.updateUserByAdminInDB(userId, payload);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User updated successfully',
    data: {
      id: (result as any)?._id,
      updatedAt: result?.updatedAt,
    },
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await UserService.deleteUserPermanentlyFromDB(userId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User deleted permanently',
    data: { id: result?._id },
  });
});

const getAllUserRoles = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getAllUserRolesFromDB(req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User list fetched',
    meta: result.meta,
    data: result.data,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requester = req.user as JwtPayload;

  const result = await UserService.getUserByIdFromDB(userId, requester);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User data retrieved',
    data: result,
  });
});

const getUserDetailsById = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const requester = req.user as JwtPayload;

  const result = await UserService.getUserDetailsByIdFromDB(userId, requester);

  // User-scoped, may change the moment the target updates. Disable shared
  // and disk caching. Clients treat each call as fresh.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User details retrieved successfully',
    data: result,
  });
});

const getUserMetrics = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserMetricsFromDB();

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User metrics retrieved',
    data: result,
  });
});

const getUserProfiles = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.getUserProfilesFromDB(user, req.query);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User profiles fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const requestAccountDeletion = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { password } = req.body as { password: string };

  const result = await UserService.requestAccountDeletionFromDB(user, password);

  // The user's tokens were just invalidated server-side; clear the cookie too.
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.node_env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Account scheduled for deletion. You can restore it within the recovery window.',
    data: result,
  });
});

const requestEmailChange = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { newEmail, password } = req.body as {
    newEmail: string;
    password: string;
  };

  const result = await UserService.requestEmailChangeFromDB(user, {
    newEmail,
    password,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message:
      'Verification code sent to the new email. Confirm within the OTP window to complete the change.',
    data: result,
  });
});

const reverifyAccount = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };

  // Handle files if uploaded
  if (req.files) {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files['profileImage']) {
      payload.profileImage = (files['profileImage'][0] as any).location || files['profileImage'][0].path;
    }
  }

  const result = await UserService.reverifyAccountFromDB(payload);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message:
      'Documents re-submitted. Your account is back in review — you will receive an email once an admin approves it.',
    data: result,
  });
});

const listMySessions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.listMySessionsFromDB(user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Active sessions retrieved.',
    data: result,
  });
});

const revokeMySession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { tokenId } = req.params;

  const result = await UserService.revokeMySessionFromDB(user, tokenId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Session revoked.',
    data: result,
  });
});

const revokeAllMySessions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.revokeAllMySessionsFromDB(user);

  // tokenVersion was bumped — wipe the refresh cookie so the current
  // browser can't ride its old refresh token.
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.node_env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'All sessions revoked. Please log in again.',
    data: result,
  });
});

const exportMyData = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await UserService.exportMyDataFromDB(user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Personal data export generated.',
    data: result,
  });
});

const confirmEmailChange = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { otp } = req.body as { otp: string };

  const result = await UserService.confirmEmailChangeFromDB(user, otp);

  // tokenVersion was bumped — wipe the refresh-token cookie so the browser
  // can't retry with stale credentials.
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.node_env === 'production',
    sameSite: 'lax' as const,
    path: '/',
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Email changed successfully. Please log in again with the new email.',
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { status } = req.body as { status: USER_STATUS };

  const result = await UserService.updateUserStatusInDB(userId, status);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'User status updated',
    data: result,
  });
});

const bulkDeleteUsers = catchAsync(async (req: Request, res: Response) => {
  const { userIds } = req.body as { userIds: string[] };
  const result = await UserService.bulkDeleteUsersFromDB(userIds);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: `${result.deletedCount} users deleted successfully`,
  });
});

const exportUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.exportUsersFromDB(req.query);

  await new ExportBuilder(result)
    .format('csv')
    .columns([
      'name',
      'email',
      'status',
      'role',
      'coins',
      'subscriptionStatus',
      'subscriptionPlan',
      'createdAt',
    ])
    .headers({
      name: 'User Name',
      email: 'Email',
      status: 'Status',
      role: 'Role',
      coins: 'Coins',
      subscriptionStatus: 'Subscription Status',
      subscriptionPlan: 'Plan',
      createdAt: 'Joined At',
    })
    .sendResponse(res, `users-export-${Date.now()}`);
});
export const UserController = {
  updateUserStatus,
  bulkDeleteUsers,
  exportUsers,
  createUser,
  getUserProfile,
  updateProfile,
  getAllUserRoles,
  updateUserReview,
  adminUpdateUser,
  deleteUser,
  getUserById,
  getUserDetailsById,
  getUserMetrics,
  requestAccountDeletion,
  requestEmailChange,
  confirmEmailChange,
  exportMyData,
  listMySessions,
  revokeMySession,
  revokeAllMySessions,
  reverifyAccount,
  getUserProfiles,
};
