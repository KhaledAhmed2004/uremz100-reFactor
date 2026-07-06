import { z } from 'zod';
import { USER_ROLES, USER_STATUS } from '../../../enums/user';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;

const createUserZodSchema = z.object({
  body: z
    .object({
      name: z.string({ required_error: 'Name is required' }).min(1),
      phone: z.string({ required_error: 'Phone is required' }).min(1),
      email: z
        .string({ required_error: 'Email is required' })
        .email('Invalid email address')
        .toLowerCase(),
      dateOfBirth: z.string({ required_error: 'Date of birth is required' }).datetime(),
      role: z.enum([USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.USER]).optional().default(USER_ROLES.USER),
      password: z.string().optional(),
      googleId: z.string().optional(),
      appleId: z.string().optional(),
      captchaToken: z.string().optional(),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (!data.googleId && !data.appleId) {
        if (!data.password || data.password.length === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password is required', path: ['password'] });
        } else if (!passwordRegex.test(data.password)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Password must include upper, lower, number, special and be 8+ chars',
            path: ['password']
          });
        }
      }
    }),
});

const updateUserZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    dateOfBirth: z.string().datetime().optional(),
    profileImage: z.string().optional(),
  }),
});

export const UserValidation = {
  createUserZodSchema,
  updateUserZodSchema,
  updateUserStatusZodSchema: z.object({
    params: z.object({
      userId: z.string({ required_error: 'User ID is required' }),
    }),
    body: z.object({
      status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.REJECTED, USER_STATUS.SUSPENDED], {
        required_error: 'status is required',
      })
    }),
  }),
  updateUserReviewZodSchema: z.object({
    params: z.object({
      userId: z.string({ required_error: 'User ID is required' }),
    }),
    body: z.object({
      status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.REJECTED], {
        required_error: 'Status is required (ACTIVE or REJECTED)',
      })
    })
  }),
  adminUpdateUserZodSchema: z.object({
    params: z.object({
      userId: z.string({ required_error: 'User ID is required' }),
    }),
    body: z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email('Invalid email address').toLowerCase().optional(),
      dateOfBirth: z.string().datetime().optional(),
      status: z.enum([
        USER_STATUS.PENDING,
        USER_STATUS.ACTIVE,
        USER_STATUS.REJECTED,
        USER_STATUS.SUSPENDED,
        USER_STATUS.DELETED,
      ]).optional(),
      role: z.enum([
        USER_ROLES.SUPER_ADMIN, 
        USER_ROLES.ADMIN, 
        USER_ROLES.USER
      ]).optional(),
    }),
  }),
  getUserDetailsZodSchema: z.object({
    params: z.object({
      userId: z
        .string({ required_error: 'User ID is required' })
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid User ID format'),
    }),
  }),
  deleteAccountZodSchema: z.object({
    body: z.object({
      password: z
        .string({ required_error: 'Password is required to confirm account deletion' })
        .min(1, 'Password is required to confirm account deletion'),
    }),
  }),
  requestEmailChangeZodSchema: z.object({
    body: z.object({
      newEmail: z
        .string({ required_error: 'New email is required' })
        .email('Invalid email address')
        .toLowerCase(),
      password: z
        .string({ required_error: 'Password is required to confirm email change' })
        .min(1, 'Password is required to confirm email change'),
    }),
  }),
  confirmEmailChangeZodSchema: z.object({
    body: z.object({
      otp: z
        .string({ required_error: 'OTP is required' })
        .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
    }),
  }),
  revokeSessionZodSchema: z.object({
    params: z.object({
      tokenId: z
        .string({ required_error: 'Token ID is required' })
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Token ID format'),
    }),
  }),
  reverifyAccountZodSchema: z.object({
    body: z.object({
      token: z
        .string({ required_error: 'Re-verification token is required' })
        .regex(/^[0-9a-fA-F]{64}$/, 'Invalid re-verification token format'),
    }),
  }),
  getAllUserRolesZodSchema: z.object({
    query: z.object({
      searchTerm: z.string().optional(),
      email: z.string().optional(),
      role: z.enum([USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.USER]).optional(),
      status: z.enum([
        USER_STATUS.PENDING,
        USER_STATUS.ACTIVE,
        USER_STATUS.REJECTED,
        USER_STATUS.SUSPENDED,
        USER_STATUS.DELETED,
      ]).optional(),
      isVerified: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
    }),
  }),
};
