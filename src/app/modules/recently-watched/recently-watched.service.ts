import httpStatus from 'http-status';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Content } from '../content/content.model';
import { RecentlyWatched } from './recently-watched.model';

const trackProgressInDB = async (
  payload: {
    userId?: string;
    guestId?: string;
    contentId: string;
    watchedSeconds: number;
  },
) => {
  const { userId, guestId, contentId, watchedSeconds } = payload;
  
  if (!userId && !guestId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID or Guest ID is required');
  }

  const content = await Content.findById(contentId);
  if (!content) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found');
  }

  // Calculate completion percentage automatically
  // content.duration is in minutes, convert to seconds
  const totalSeconds = content.duration * 60;
  const completionPercentage = totalSeconds > 0 
    ? Math.min(Math.round((watchedSeconds / totalSeconds) * 100), 100) 
    : 0;

  // Build the query object for user or guest
  const query = userId 
    ? { userId: new Types.ObjectId(userId), contentId: new Types.ObjectId(contentId) }
    : { guestId, contentId: new Types.ObjectId(contentId) };

  const updateData: any = {
    contentId: new Types.ObjectId(contentId),
    watchedSeconds,
    completionPercentage,
    lastWatchedAt: new Date(),
  };

  if (userId) {
    updateData.userId = new Types.ObjectId(userId);
  } else if (guestId) {
    updateData.guestId = guestId;
  }

  // Check if a record already exists before upserting
  const existingRecord = await RecentlyWatched.findOne(query);

  // Upsert recently watched record
  const result = await RecentlyWatched.findOneAndUpdate(
    query,
    updateData,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  // Calculate incremental watch time in seconds
  let watchDurationDelta = watchedSeconds;
  if (existingRecord && existingRecord.watchedSeconds < watchedSeconds) {
    watchDurationDelta = watchedSeconds - existingRecord.watchedSeconds;
  }

  // If this is the first time watching (no existing record), increment view count
  const incQuery: any = { totalWatchTime: watchDurationDelta };
  if (!existingRecord && watchedSeconds > 0) {
    incQuery.views = 1;
    incQuery.dailyViews = 1;
    incQuery.weeklyViews = 1;
  }

  if (watchDurationDelta > 0 || !existingRecord) {
    await Content.findByIdAndUpdate(contentId, { $inc: incQuery });
  }

  return result;
};

const getRecentlyWatchedFromDB = async (userId?: string, guestId?: string) => {
  if (!userId && !guestId) return [];

  const query = userId ? { userId: new Types.ObjectId(userId) } : { guestId };

  const cardFields = 'title poster type isPremium releaseDate rating publishedAt createdAt';

  const result = await RecentlyWatched.find(query)
    .populate('contentId', cardFields)
    .sort({ lastWatchedAt: -1 })
    .limit(20);
  
  return result;
};

const getProgressByContentIdFromDB = async (contentId: string, userId?: string, guestId?: string) => {
  if (!userId && !guestId) return null;

  const query: any = { contentId: new Types.ObjectId(contentId) };
  if (userId) {
    query.userId = new Types.ObjectId(userId);
  } else {
    query.guestId = guestId;
  }

  const result = await RecentlyWatched.findOne(query);
  return result;
};

export const RecentlyWatchedService = {
  trackProgressInDB,
  getRecentlyWatchedFromDB,
  getProgressByContentIdFromDB,
};
