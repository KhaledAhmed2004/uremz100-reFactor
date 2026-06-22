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
exports.seedSeries = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const content_model_1 = require("../app/modules/content/content.model");
const season_model_1 = require("../app/modules/content/season.model");
const episode_model_1 = require("../app/modules/content/episode.model");
const genre_model_1 = require("../app/modules/genre/genre.model");
const logger_1 = require("../shared/logger");
const seriesVideos = [
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
    'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
    'http://vjs.zencdn.net/v/oceans.mp4',
];
const seedSeries = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Connect to the database
        yield mongoose_1.default.connect(config_1.default.database_url);
        logger_1.logger.info('Connected to MongoDB for seeding Series...');
        // 1. Setup Genres
        const genreNames = ['Drama', 'Action', 'Mystery'];
        const genreIds = [];
        for (const name of genreNames) {
            const genre = yield genre_model_1.Genre.findOneAndUpdate({ name }, { name, description: `${name} series` }, { upsert: true, new: true });
            if (genre) {
                genreIds.push(genre._id);
            }
        }
        // 2. Prepare Series Data
        for (let i = 0; i < 5; i++) {
            const isPremium = i % 2 === 0;
            const series = yield content_model_1.Content.create({
                title: `Epic Series ${i + 1}`,
                description: `This is an amazing series seeded for testing. It has 2 seasons.`,
                type: 'SERIES',
                status: 'PUBLISHED',
                planStatus: isPremium ? ['MONTHLY', 'YEARLY'] : ['FREE'],
                genres: genreIds,
                posterUrl: `https://picsum.photos/seed/series${i}/1920/1080`,
                duration: 0,
                releaseYear: 2023,
                views: Math.floor(Math.random() * 100000),
                dailyViews: Math.floor(Math.random() * 1000),
                weeklyViews: Math.floor(Math.random() * 5000),
                totalWatchTime: Math.floor(Math.random() * 5000000),
                seasonsCount: 2,
                totalEpisodes: 6,
                isPopularSeries: i === 0,
                cast: ['Actor A', 'Actor B']
            });
            for (let s = 1; s <= 2; s++) {
                const season = yield season_model_1.Season.create({
                    title: `Season ${s}`,
                    posterUrl: `https://picsum.photos/seed/season${i}_${s}/800/1200`,
                    seriesId: series._id,
                    seasonNumber: s
                });
                for (let e = 1; e <= 3; e++) {
                    const requiresCoin = e === 3 ? 50 : 0; // Third episode requires coins
                    yield episode_model_1.Episode.create({
                        title: `Episode ${e}`,
                        description: `This is episode ${e} of season ${s}.`,
                        videoUrl: seriesVideos[e % seriesVideos.length],
                        thumbnailUrl: `https://picsum.photos/seed/episode${i}_${s}_${e}/400/225`,
                        duration: 45,
                        releaseDate: new Date(),
                        status: 'PUBLISHED',
                        planStatus: series.planStatus,
                        seasonId: season._id,
                        seriesId: series._id,
                        seasonNumber: s,
                        episodeNumber: e,
                        requiredCoin: requiresCoin
                    });
                }
            }
        }
        logger_1.logger.info('✨ Successfully seeded Series, Seasons, and Episodes!');
    }
    catch (error) {
        logger_1.logger.error('Error seeding Series:', error);
    }
    finally {
        // Cleanly close connection
        yield mongoose_1.default.disconnect();
        logger_1.logger.info('Disconnected from MongoDB.');
    }
});
exports.seedSeries = seedSeries;
// Execute
(0, exports.seedSeries)().then(() => process.exit(0));
