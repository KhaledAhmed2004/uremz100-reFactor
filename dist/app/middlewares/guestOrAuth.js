"use strict";
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
const config_1 = __importDefault(require("../../config"));
const jwtHelper_1 = require("../../helpers/jwtHelper");
/**
 * Middleware to support both Guest and Authenticated users.
 * - If a valid Bearer token is provided, it extracts the user ID and sets `req.user`.
 * - If no token is provided but an `x-guest-id` header is present, it sets `req.guestId`.
 * - If neither is provided, it can either reject or pass through (currently passes through so controllers can validate).
 */
const guestOrAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers.authorization;
        const guestIdHeader = req.headers['x-guest-id'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && token.trim() !== '') {
                try {
                    const verifiedUser = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
                    if (verifiedUser) {
                        req.user = verifiedUser;
                    }
                }
                catch (error) {
                    // Token is invalid/expired, we can ignore and fallback to guest, 
                    // or we can let it fail. Let's ignore it here and if they don't have guestId, they will be unauthorized.
                }
            }
        }
        if (!req.user && guestIdHeader && typeof guestIdHeader === 'string') {
            req.guestId = guestIdHeader;
        }
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.default = guestOrAuth;
