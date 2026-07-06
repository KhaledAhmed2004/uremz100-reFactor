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
exports.migrateCdnToR2 = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const OLD_DOMAIN = 'https://uremz-video-stream.b-cdn.net';
const NEW_DOMAIN = 'https://pub-085e3de5d2824de0bd78d99ef319730e.r2.dev';
const migrateCdnToR2 = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Connecting to MongoDB to migrate CDN links...`);
        yield mongoose_1.default.connect(config_1.default.database_url);
        const db = mongoose_1.default.connection.db;
        const replaceDomain = (url) => {
            if (typeof url === 'string' && url.includes(OLD_DOMAIN)) {
                return url.replace(OLD_DOMAIN, NEW_DOMAIN);
            }
            return url;
        };
        console.log(`Replacing ${OLD_DOMAIN} with ${NEW_DOMAIN} in all collections...`);
        // 1. Contents Collection
        const contents = yield db.collection('contents').find({}).toArray();
        let contentUpdates = 0;
        for (const c of contents) {
            const updates = {};
            if (c.posterUrl)
                updates.posterUrl = replaceDomain(c.posterUrl);
            if (c.trailerUrl)
                updates.trailerUrl = replaceDomain(c.trailerUrl);
            // Update if any of them actually changed
            if (updates.posterUrl !== c.posterUrl || updates.trailerUrl !== c.trailerUrl) {
                yield db.collection('contents').updateOne({ _id: c._id }, { $set: updates });
                contentUpdates++;
            }
        }
        console.log(`Updated ${contentUpdates} records in Contents.`);
        // 2. Seasons Collection
        const seasons = yield db.collection('seasons').find({}).toArray();
        let seasonUpdates = 0;
        for (const s of seasons) {
            const updates = {};
            if (s.posterUrl)
                updates.posterUrl = replaceDomain(s.posterUrl);
            if (s.trailerUrl)
                updates.trailerUrl = replaceDomain(s.trailerUrl);
            if (updates.posterUrl !== s.posterUrl || updates.trailerUrl !== s.trailerUrl) {
                yield db.collection('seasons').updateOne({ _id: s._id }, { $set: updates });
                seasonUpdates++;
            }
        }
        console.log(`Updated ${seasonUpdates} records in Seasons.`);
        // 3. Episodes Collection
        const episodes = yield db.collection('episodes').find({}).toArray();
        let episodeUpdates = 0;
        for (const ep of episodes) {
            const updates = {};
            if (ep.videoUrl)
                updates.videoUrl = replaceDomain(ep.videoUrl);
            if (ep.thumbnailUrl)
                updates.thumbnailUrl = replaceDomain(ep.thumbnailUrl);
            if (updates.videoUrl !== ep.videoUrl || updates.thumbnailUrl !== ep.thumbnailUrl) {
                yield db.collection('episodes').updateOne({ _id: ep._id }, { $set: updates });
                episodeUpdates++;
            }
        }
        console.log(`Updated ${episodeUpdates} records in Episodes.`);
        // 4. Users Collection
        const users = yield db.collection('users').find({}).toArray();
        let userUpdates = 0;
        for (const u of users) {
            const updates = {};
            if (u.profileImage)
                updates.profileImage = replaceDomain(u.profileImage);
            if (u.verificationImage)
                updates.verificationImage = replaceDomain(u.verificationImage);
            if (updates.profileImage !== u.profileImage || updates.verificationImage !== u.verificationImage) {
                yield db.collection('users').updateOne({ _id: u._id }, { $set: updates });
                userUpdates++;
            }
        }
        console.log(`Updated ${userUpdates} records in Users.`);
        console.log('✨ All CDN links have been successfully migrated to R2 directly!');
    }
    catch (error) {
        console.error('Error during CDN migration:', error);
    }
    finally {
        yield mongoose_1.default.disconnect();
        console.log('Disconnected from MongoDB.');
    }
});
exports.migrateCdnToR2 = migrateCdnToR2;
(0, exports.migrateCdnToR2)().then(() => process.exit(0));
