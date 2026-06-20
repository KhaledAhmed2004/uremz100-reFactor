"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserValidation = void 0;
const zod_1 = require("zod");
const user_1 = require("../../../enums/user");
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/;
const createUserZodSchema = zod_1.z.object({
    body: zod_1.z
        .object({
        name: zod_1.z.string({ required_error: 'Name is required' }).min(1),
        email: zod_1.z
            .string({ required_error: 'Email is required' })
            .email('Invalid email address')
            .toLowerCase(),
        role: zod_1.z.enum([user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER]).optional().default(user_1.USER_ROLES.USER),
        password: zod_1.z.string().optional(),
        googleId: zod_1.z.string().optional(),
        appleId: zod_1.z.string().optional(),
        captchaToken: zod_1.z.string().optional(),
    })
        .strict()
        .superRefine((data, ctx) => {
        if (!data.googleId && !data.appleId) {
            if (!data.password || data.password.length === 0) {
                ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'Password is required', path: ['password'] });
            }
            else if (!passwordRegex.test(data.password)) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'Password must include upper, lower, number, special and be 8+ chars',
                    path: ['password']
                });
            }
        }
    }),
});
const updateUserZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
        dateOfBirth: zod_1.z.string().datetime().optional(),
        profileImage: zod_1.z.string().optional(),
        location: zod_1.z
            .preprocess((v) => {
            if (typeof v === 'string') {
                try {
                    return JSON.parse(v);
                }
                catch (_a) {
                    return v;
                }
            }
            return v;
        }, zod_1.z.object({
            country: zod_1.z.string().optional(),
            city: zod_1.z.string().optional()
        }))
            .optional()
    }),
});
exports.UserValidation = {
    createUserZodSchema,
    updateUserZodSchema,
    updateUserStatusZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            userId: zod_1.z.string({ required_error: 'User ID is required' }),
        }),
        body: zod_1.z.object({
            status: zod_1.z.enum([user_1.USER_STATUS.ACTIVE, user_1.USER_STATUS.REJECTED, user_1.USER_STATUS.SUSPENDED], {
                required_error: 'status is required',
            })
        }),
    }),
    updateUserReviewZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            userId: zod_1.z.string({ required_error: 'User ID is required' }),
        }),
        body: zod_1.z.object({
            status: zod_1.z.enum([user_1.USER_STATUS.ACTIVE, user_1.USER_STATUS.REJECTED], {
                required_error: 'Status is required (ACTIVE or REJECTED)',
            })
        })
    }),
    adminUpdateUserZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            userId: zod_1.z.string({ required_error: 'User ID is required' }),
        }),
        body: zod_1.z.object({
            name: zod_1.z.string().optional(),
            gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
            email: zod_1.z.string().email('Invalid email address').toLowerCase().optional(),
            dateOfBirth: zod_1.z.string().datetime().optional(),
            status: zod_1.z.enum([
                user_1.USER_STATUS.PENDING,
                user_1.USER_STATUS.ACTIVE,
                user_1.USER_STATUS.REJECTED,
                user_1.USER_STATUS.SUSPENDED,
                user_1.USER_STATUS.DELETED,
            ]).optional(),
            role: zod_1.z.enum([
                user_1.USER_ROLES.SUPER_ADMIN,
                user_1.USER_ROLES.ADMIN,
                user_1.USER_ROLES.USER
            ]).optional(),
            location: zod_1.z
                .preprocess((v) => {
                if (typeof v === 'string') {
                    try {
                        return JSON.parse(v);
                    }
                    catch (_a) {
                        return v;
                    }
                }
                return v;
            }, zod_1.z.object({
                country: zod_1.z.string().optional(),
                city: zod_1.z.string().optional()
            }))
                .optional()
        }),
    }),
    getUserDetailsZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            userId: zod_1.z
                .string({ required_error: 'User ID is required' })
                .regex(/^[0-9a-fA-F]{24}$/, 'Invalid User ID format'),
        }),
    }),
    deleteAccountZodSchema: zod_1.z.object({
        body: zod_1.z.object({
            password: zod_1.z
                .string({ required_error: 'Password is required to confirm account deletion' })
                .min(1, 'Password is required to confirm account deletion'),
        }),
    }),
    requestEmailChangeZodSchema: zod_1.z.object({
        body: zod_1.z.object({
            newEmail: zod_1.z
                .string({ required_error: 'New email is required' })
                .email('Invalid email address')
                .toLowerCase(),
            password: zod_1.z
                .string({ required_error: 'Password is required to confirm email change' })
                .min(1, 'Password is required to confirm email change'),
        }),
    }),
    confirmEmailChangeZodSchema: zod_1.z.object({
        body: zod_1.z.object({
            otp: zod_1.z
                .string({ required_error: 'OTP is required' })
                .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
        }),
    }),
    revokeSessionZodSchema: zod_1.z.object({
        params: zod_1.z.object({
            tokenId: zod_1.z
                .string({ required_error: 'Token ID is required' })
                .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Token ID format'),
        }),
    }),
    reverifyAccountZodSchema: zod_1.z.object({
        body: zod_1.z.object({
            token: zod_1.z
                .string({ required_error: 'Re-verification token is required' })
                .regex(/^[0-9a-fA-F]{64}$/, 'Invalid re-verification token format'),
        }),
    }),
    getAllUserRolesZodSchema: zod_1.z.object({
        query: zod_1.z.object({
            searchTerm: zod_1.z.string().optional(),
            email: zod_1.z.string().optional(),
            role: zod_1.z.enum([user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER]).optional(),
            status: zod_1.z.enum([
                user_1.USER_STATUS.PENDING,
                user_1.USER_STATUS.ACTIVE,
                user_1.USER_STATUS.REJECTED,
                user_1.USER_STATUS.SUSPENDED,
                user_1.USER_STATUS.DELETED,
            ]).optional(),
            isVerified: zod_1.z.string().optional(),
            page: zod_1.z.string().optional(),
            limit: zod_1.z.string().optional(),
            sortBy: zod_1.z.string().optional(),
            sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
        }),
    }),
};
