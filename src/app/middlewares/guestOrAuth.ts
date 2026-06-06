import { NextFunction, Request, Response } from 'express';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import { jwtHelper } from '../../helpers/jwtHelper';
import { JwtUser } from '../../types';

/**
 * Middleware to support both Guest and Authenticated users.
 * - If a valid Bearer token is provided, it extracts the user ID and sets `req.user`.
 * - If no token is provided but an `x-guest-id` header is present, it sets `req.guestId`.
 * - If neither is provided, it can either reject or pass through (currently passes through so controllers can validate).
 */
const guestOrAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const guestIdHeader = req.headers['x-guest-id'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token && token.trim() !== '') {
        try {
          const verifiedUser = jwtHelper.verifyToken(
            token,
            config.jwt.jwt_secret as Secret,
          );
          if (verifiedUser) {
            req.user = verifiedUser as JwtUser;
          }
        } catch (error) {
          // Token is invalid/expired, we can ignore and fallback to guest, 
          // or we can let it fail. Let's ignore it here and if they don't have guestId, they will be unauthorized.
        }
      }
    }

    if (!req.user && guestIdHeader && typeof guestIdHeader === 'string') {
      req.guestId = guestIdHeader;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default guestOrAuth;
