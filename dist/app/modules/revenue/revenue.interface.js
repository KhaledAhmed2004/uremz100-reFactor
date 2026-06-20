"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVENUE_STATUS = exports.REVENUE_PLATFORM = void 0;
var REVENUE_PLATFORM;
(function (REVENUE_PLATFORM) {
    REVENUE_PLATFORM["APPLE"] = "apple";
    REVENUE_PLATFORM["GOOGLE"] = "google";
    REVENUE_PLATFORM["STRIPE"] = "stripe";
    REVENUE_PLATFORM["ADMIN"] = "admin";
})(REVENUE_PLATFORM || (exports.REVENUE_PLATFORM = REVENUE_PLATFORM = {}));
var REVENUE_STATUS;
(function (REVENUE_STATUS) {
    REVENUE_STATUS["SUCCESS"] = "SUCCESS";
    REVENUE_STATUS["FAILED"] = "FAILED";
    REVENUE_STATUS["REFUNDED"] = "REFUNDED";
})(REVENUE_STATUS || (exports.REVENUE_STATUS = REVENUE_STATUS = {}));
