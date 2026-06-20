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
exports.seedShorts = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const content_model_1 = require("../app/modules/content/content.model");
const genre_model_1 = require("../app/modules/genre/genre.model");
const logger_1 = require("../shared/logger");
// List of real vertical/short video URLs for a realistic feel (Real-life demo videos converted to 9:16 ratio)
const shortVideos = [
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/dog.mp4',
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/elephants.mp4',
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/sea_turtle.mp4',
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/skater.mp4',
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/snowboarding.mp4',
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/kitten-playing.mp4',
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/rooster.mp4',
    'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/boy-spiderman.mp4'
];
const seedShorts = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Connect to the real local database
        yield mongoose_1.default.connect(config_1.default.database_url);
        logger_1.logger.info('Connected to MongoDB for seeding Shorts...');
        // 1. Ensure we have at least one Genre, as it's required by the Content model
        let genre = yield genre_model_1.Genre.findOne({ name: 'Entertainment' });
        if (!genre) {
            genre = yield genre_model_1.Genre.create({ name: 'Entertainment', description: 'General entertainment content' });
        }
        // 2. Prepare 10 Realistic Shorts (All Free Content as requested)
        const shortsData = [];
        // Optional: Clear existing content if you want a clean slate
        // await Content.deleteMany({ title: { $regex: 'Short' } });
        for (let i = 0; i < 10; i++) {
            const videoId = i % shortVideos.length;
            shortsData.push({
                title: `Viral Free Short ${i + 1}`,
                description: 'A quick viral moment caught on camera, completely free to watch!',
                type: 'MOVIE', // The codebase only accepts MOVIE or SERIES. Shorts logic depends on FREE plan.
                status: 'PUBLISHED',
                planStatus: ['FREE'], // Ensuring all of them are proper free videos
                genres: [genre._id],
                videoUrl: shortVideos[videoId],
                posterUrl: `https://picsum.photos/seed/viral${i}/400/600`, // Vertical poster dimension
                duration: 1, // in minutes (required)
                releaseYear: 2024,
                publishedAt: new Date(Date.now() - i * 100000), // Staggered to test infinite scroll sorting
                views: Math.floor(Math.random() * 50000) + 1000,
                engagementScore: Math.floor(Math.random() * 100) + 20,
                trendingScore: Math.floor(Math.random() * 100) + 20,
            });
        }
        // Insert them
        yield content_model_1.Content.insertMany(shortsData);
        logger_1.logger.info(`✨ Successfully seeded ${shortsData.length} Proper Free Shorts into the development database!`);
    }
    catch (error) {
        logger_1.logger.error('Error seeding Shorts:', error);
    }
    finally {
        // Cleanly close connection so the script exits
        yield mongoose_1.default.disconnect();
        logger_1.logger.info('Disconnected from MongoDB.');
    }
});
exports.seedShorts = seedShorts;
// Execute
(0, exports.seedShorts)().then(() => process.exit(0));
