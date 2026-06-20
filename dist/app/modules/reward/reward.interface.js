"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionSource = exports.CurrencyType = exports.TransactionType = void 0;
var TransactionType;
(function (TransactionType) {
    TransactionType["EARN"] = "earn";
    TransactionType["SPEND"] = "spend";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var CurrencyType;
(function (CurrencyType) {
    CurrencyType["GOLD"] = "gold";
    CurrencyType["BONUS"] = "bonus";
})(CurrencyType || (exports.CurrencyType = CurrencyType = {}));
var TransactionSource;
(function (TransactionSource) {
    TransactionSource["WATCH_TIME"] = "watch_time";
    TransactionSource["DAILY_CHECK_IN"] = "daily_check_in";
    TransactionSource["WATCH_AD"] = "watch_ad";
    TransactionSource["ENABLE_NOTIFICATION"] = "enable_notification";
    TransactionSource["PROFILE_COMPLETION"] = "profile_completion";
    TransactionSource["FOLLOW_FACEBOOK"] = "follow_facebook";
    TransactionSource["FOLLOW_INSTAGRAM"] = "follow_instagram";
    TransactionSource["FOLLOW_YOUTUBE"] = "follow_youtube";
    TransactionSource["BIND_EMAIL"] = "bind_email";
    TransactionSource["FRESH_DRAMA"] = "fresh_drama";
    TransactionSource["LOGIN_REWARD"] = "login_reward";
    TransactionSource["SPEND_UNLOCK"] = "spend_unlock";
})(TransactionSource || (exports.TransactionSource = TransactionSource = {}));
