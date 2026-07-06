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
exports.migrateCoinsToEpisodes = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const migrateCoinsToEpisodes = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Connecting to MongoDB for Migration...');
        yield mongoose_1.default.connect(config_1.default.database_url);
        const db = mongoose_1.default.connection.db;
        // 1. Migrate Season Coins to Episodes
        console.log('--- 1. Migrating requiredCoin from Seasons to Episodes ---');
        const seasonsCursor = db.collection('seasons').find({ requiredCoin: { $gt: 0 } });
        const seasons = yield seasonsCursor.toArray();
        console.log(`Found ${seasons.length} seasons that require coins.`);
        for (const season of seasons) {
            // Apply the season's coin requirement to all its episodes
            const result = yield db.collection('episodes').updateMany({ seasonId: season._id }, { $set: { requiredCoin: season.requiredCoin } });
            console.log(`Updated ${result.modifiedCount} episodes for Season ${season._id}`);
            // Clean up the old field from the season
            yield db.collection('seasons').updateOne({ _id: season._id }, { $unset: { requiredCoin: "" } });
        }
        // 2. Migrate UnlockedSeason to UnlockedEpisode
        console.log('--- 2. Migrating Unlocked Seasons to Unlocked Episodes ---');
        const unlockedSeasonsCursor = db.collection('unlockedseasons').find({});
        const unlockedSeasons = yield unlockedSeasonsCursor.toArray();
        console.log(`Found ${unlockedSeasons.length} unlocked season records to migrate.`);
        for (const us of unlockedSeasons) {
            // Find all episodes associated with this unlocked season
            const episodes = yield db.collection('episodes').find({ seasonId: us.seasonId }).toArray();
            const unlockedEpisodesToInsert = episodes.map(ep => ({
                userId: us.userId,
                episodeId: ep._id,
                unlockedAt: us.createdAt || new Date(),
                createdAt: us.createdAt || new Date(),
                updatedAt: us.updatedAt || new Date()
            }));
            if (unlockedEpisodesToInsert.length > 0) {
                try {
                    // ordered: false ensures that if some episodes are already unlocked, it doesn't fail the whole batch
                    yield db.collection('unlockedepisodes').insertMany(unlockedEpisodesToInsert, { ordered: false });
                }
                catch (error) {
                    // Ignore duplicate key errors (code 11000)
                    if (error.code !== 11000) {
                        console.error(`Error inserting unlocked episodes for user ${us.userId}:`, error);
                    }
                }
            }
        }
        console.log('✨ Migration completed successfully!');
    }
    catch (error) {
        console.error('Error during migration:', error);
    }
    finally {
        yield mongoose_1.default.disconnect();
        console.log('Disconnected from MongoDB.');
    }
});
exports.migrateCoinsToEpisodes = migrateCoinsToEpisodes;
(0, exports.migrateCoinsToEpisodes)().then(() => process.exit(0));
