import httpStatus from 'http-status';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Content } from '../content/content.model';
import { RecentlyWatched } from './recently-watched.model';

const trackProgressInDB = async (
  userId: string,
  payload: {
    contentId: string;
    watchedSeconds: number;
  },
) => {
  const { contentId, watchedSeconds } = payload;

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

  // Upsert recently watched record
  const result = await RecentlyWatched.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
    },
    {
      userId: new Types.ObjectId(userId),
      contentId: new Types.ObjectId(contentId),
      watchedSeconds,
      completionPercentage,
      lastWatchedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  // If this is the first time watching (or progress is low), increment view count? 
  // Usually, views are incremented on start. For now, let's just track progress.
  if (watchedSeconds > 0) {
    await Content.findByIdAndUpdate(contentId, { $inc: { views: 1 } });
  }

  return result;
};

const getRecentlyWatchedFromDB = async (userId: string) => {
  const result = await RecentlyWatched.find({ userId: new Types.ObjectId(userId) })
    .populate('contentId')
    .sort({ lastWatchedAt: -1 })
    .limit(20);
  
  return result;
};

export const RecentlyWatchedService = {
  trackProgressInDB,
  getRecentlyWatchedFromDB,
};
