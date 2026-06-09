import { Content } from '../content/content.model';
import mongoose from 'mongoose';
import { Review } from '../review/review.model';

const getShortsFeed = async (cursor?: string, limit: number = 10) => {
  const query: any = {
    status: 'PUBLISHED',
    $or: [
      { planStatus: { $in: ['FREE'] } },
      { type: 'MOVIE', trailerUrl: { $exists: true, $nin: [null, ''] } }
    ]
  };

  if (cursor) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const limitNumber = Number(limit);
  // Fetch limit + 1 to check if there is a next page
  const contents = await Content.find(query)
    .sort({ _id: -1 })
    .limit(limitNumber + 1)
    .lean();

  const hasNextPage = contents.length > limitNumber;
  if (hasNextPage) {
    contents.pop(); // Remove the extra item
  }

  const data = contents.map((doc: any) => {
    // If it's a premium movie with a trailer, treat it as a trailer
    const isTrailer = doc.type === 'MOVIE' && !doc.planStatus?.includes('FREE') && doc.trailerUrl;
    
    return {
      id: isTrailer ? `${doc._id}_trailer` : doc._id.toString(),
      contentId: doc._id.toString(),
      title: doc.title,
      description: doc.description,
      videoUrl: isTrailer ? doc.trailerUrl : doc.videoUrl,
      poster: doc.poster,
      type: isTrailer ? 'TRAILER' : 'FREE_CONTENT',
    };
  });

  const nextCursor = data.length > 0 ? contents[contents.length - 1]._id.toString() : null;

  return {
    meta: {
      limit: limitNumber,
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
    },
    data,
  };
};

const incrementShortViewInDB = async (contentId: string) => {
  const result = await Content.findByIdAndUpdate(
    contentId,
    { $inc: { views: 1, dailyViews: 1, weeklyViews: 1 } },
    { new: true, select: 'title views' }
  );
  return result;
};

export const ShortsService = {
  getShortsFeed,
  incrementShortViewInDB,
};
