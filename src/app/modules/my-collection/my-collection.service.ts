import httpStatus from 'http-status';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Content } from '../content/content.model';
import { Season } from '../content/season.model';
import { Episode } from '../content/episode.model';
import { MyCollection } from './my-collection.model';
import QueryBuilder from '../../builder/QueryBuilder';

const addToCollectionInDB = async (
  payload: {
    userId?: string;
    guestId?: string;
    itemId: string;
  },
) => {
  const { userId, guestId, itemId } = payload;
  if (!userId && !guestId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID or Guest ID is required');
  }

  let itemType: 'MOVIE' | 'SERIES' | 'SEASON' | 'EPISODE' | undefined;
  let itemModel: 'Content' | 'Season' | 'Episode' | undefined;

  // 1. Check in Content model (Movies & Series)
  const contentItem = await Content.findById(itemId);
  if (contentItem) {
    itemType = contentItem.type; // Will be 'MOVIE' or 'SERIES'
    itemModel = 'Content';
  } else {
    // 2. Check in Season model
    const seasonItem = await Season.findById(itemId);
    if (seasonItem) {
      itemType = 'SEASON';
      itemModel = 'Season';
    } else {
      // 3. Check in Episode model
      const episodeItem = await Episode.findById(itemId);
      if (episodeItem) {
        itemType = 'EPISODE';
        itemModel = 'Episode';
      }
    }
  }

  if (!itemType || !itemModel) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Content not found in any category');
  }

  const query = userId
    ? { userId: new Types.ObjectId(userId), itemId: new Types.ObjectId(itemId) }
    : { guestId, itemId: new Types.ObjectId(itemId) };

  const updateData: any = {
    itemType,
    itemId: new Types.ObjectId(itemId),
    itemModel,
  };
  
  if (userId) {
    updateData.userId = new Types.ObjectId(userId);
  } else if (guestId) {
    updateData.guestId = guestId;
  }

  const result = await MyCollection.findOneAndUpdate(
    query,
    updateData,
    { upsert: true, new: true },
  );

  return result;
};

const removeFromCollectionFromDB = async (payload: { userId?: string, guestId?: string, collectionId: string }) => {
  const { userId, guestId, collectionId } = payload;
  const query = userId 
    ? { _id: collectionId, userId: new Types.ObjectId(userId) } 
    : { _id: collectionId, guestId };

  const result = await MyCollection.findOneAndDelete(query);
  
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Item not found in your collection');
  }

  return result;
};

const removeFromCollectionBulkFromDB = async (payload: { userId?: string, guestId?: string, itemIds: string[] }) => {
  const { userId, guestId, itemIds } = payload;
  
  if (!userId && !guestId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID or Guest ID is required');
  }

  const query = userId 
    ? { 
        userId: new Types.ObjectId(userId),
        $or: [{ _id: { $in: itemIds } }, { itemId: { $in: itemIds } }]
      } 
    : { 
        guestId,
        $or: [{ _id: { $in: itemIds } }, { itemId: { $in: itemIds } }]
      };

  const result = await MyCollection.deleteMany(query);

  return result.deletedCount;
};

const getMyCollectionFromDB = async (userId: string | undefined, guestId: string | undefined, query: Record<string, unknown>) => {
  if (!userId && !guestId) return { pagination: null, data: [] };

  const dbQuery = userId ? { userId: new Types.ObjectId(userId) } : { guestId };
  
  const cardFields = 'title posterUrl thumbnailUrl type isPremium releaseDate rating seasonNumber episodeNumber publishedAt createdAt';
  const myCollectionQuery = MyCollection.find(dbQuery)
    .populate('itemId', cardFields);


  const collectionQuery = new QueryBuilder(myCollectionQuery, query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await collectionQuery.modelQuery;
  const pagination = await collectionQuery.getPaginationInfo();

  return {
    pagination,
    data: result,
  };
};

export const MyCollectionService = {
  addToCollectionInDB,
  removeFromCollectionFromDB,
  removeFromCollectionBulkFromDB,
  getMyCollectionFromDB,
};
