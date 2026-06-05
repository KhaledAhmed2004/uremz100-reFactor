import { z } from 'zod';
import { USER_ROLES, USER_STATUS } from '../../../enums/user';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;

const createUserZodSchema = z.object({
  body: z
    .object({
      name: z.string({ required_error: 'Name is required' }).min(1),
      email: z
        .string({ required_error: 'Email is required' })
        .email('Invalid email address')
        .toLowerCase(),
      role: z.enum([USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH], { required_error: 'Role is required' }),
      revertDate: z.string().datetime().optional(),
      dateOfBirth: z.string({ required_error: 'Date of birth is required' }).datetime().refine((dob) => {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age >= 16;
      }, 'Minimum age is 16 years'),
      password: z.string().optional(),
      profileImage: z.string().optional(),
      verificationImage: z.string().optional(),
      verificationVideo: z.string().optional(),
      googleId: z.string().optional(),
      appleId: z.string().optional(),
      aboutMe: z.string().optional(),
      revertStory: z.string().optional(),
      interests: z
        .preprocess((v: unknown) => {
          if (typeof v === 'string') {
            try {
              return JSON.parse(v);
            } catch {
              return v;
            }
          }
          return v;
        }, z.array(z.string()))
        .optional(),
      // Cloudflare Turnstile token from the client widget. Verified by
      // the `verifyCaptcha` middleware downstream. Optional in the schema
      // so dev mode (TURNSTILE_SECRET unset) works without it; the
      // middleware no-ops in that case.
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

      if (data.role === USER_ROLES.BROTHER || data.role === USER_ROLES.SISTER) {
        if (!data.revertDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Revert date is required',
            path: ['revertDate']
          });
        }
      }
    }),
});

const updateUserZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    aboutMe: z.string().optional(),
    revertStory: z.string().optional(),
    revertDate: z.string().datetime().optional(),
    interests: z
      .preprocess((v: unknown) => {
        if (typeof v === 'string') {
          try { return JSON.parse(v); } catch { return v; }
        }
        return v;
      }, z.array(z.string()))
      .optional(),
    profileImage: z.string().optional(),
    location: z.union([
      z.object({
        country: z.string().optional(),
        city: z.string().optional(),
        latitude: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().min(-90).max(90)),
        longitude: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().min(-180).max(180))
      }),
      z.object({
        country: z.string().optional(),
        city: z.string().optional(),
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()])
      })
    ]).optional()
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
      }),
      rejectionReason: z.string().optional()
    }),
  }),
  updateUserReviewZodSchema: z.object({
    params: z.object({
      userId: z.string({ required_error: 'User ID is required' }),
    }),
    body: z.object({
      status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.REJECTED], {
        required_error: 'Status is required (ACTIVE or REJECTED)',
      }),
      reason: z.string().optional(),
    }).refine((data) => {
      if (data.status === USER_STATUS.REJECTED && !data.reason) {
        return false;
      }
      return true;
    }, {
      message: 'Reason is required when status is REJECTED',
      path: ['reason'],
    }),
  }),
  adminUpdateUserZodSchema: z.object({
    params: z.object({
      userId: z.string({ required_error: 'User ID is required' }),
    }),
    body: z.object({
      name: z.string().optional(),
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
        USER_ROLES.BROTHER, 
        USER_ROLES.SISTER,
        USER_ROLES.JUMMAH
      ]).optional(),
      revertDate: z.string().datetime().optional(),
      aboutMe: z.string().optional(),
      revertStory: z.string().optional(),
      interests: z
        .preprocess((v: unknown) => {
          if (typeof v === 'string') {
            try {
              return JSON.parse(v);
            } catch {
              return v;
            }
          }
          return v;
        }, z.array(z.string()))
        .optional(),
      location: z.union([
        z.object({
          country: z.string().optional(),
          city: z.string().optional(),
          latitude: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().min(-90).max(90)).optional(),
          longitude: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().min(-180).max(180)).optional()
        }),
        z.object({
          country: z.string().optional(),
          city: z.string().optional(),
          type: z.literal('Point'),
          coordinates: z.tuple([z.number(), z.number()])
        })
      ]).optional()
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
      // verificationImage / verificationVideo are set on req.body by
      // fileHandler after upload. Both required for a fresh review.
      verificationImage: z
        .string({ required_error: 'verificationImage is required' })
        .min(1, 'verificationImage is required'),
      verificationVideo: z
        .string({ required_error: 'verificationVideo is required' })
        .min(1, 'verificationVideo is required'),
    }),
  }),
  getAllUserRolesZodSchema: z.object({
    query: z.object({
      searchTerm: z.string().optional(),
      email: z.string().optional(),
      role: z.enum([USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH]).optional(),
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
