import httpStatus from 'http-status';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { Content } from '../content/content.model';
import { Season } from '../content/season.model';
import { Episode } from '../content/episode.model';
import { MyCollection } from './my-collection.model';
import QueryBuilder from '../../builder/QueryBuilder';

const addToCollectionInDB = async (
  userId: string,
  payload: {
    itemId: string;
  },
) => {
  const { itemId } = payload;

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

  const result = await MyCollection.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      itemId: new Types.ObjectId(itemId),
    },
    {
      userId: new Types.ObjectId(userId),
      itemType,
      itemId: new Types.ObjectId(itemId),
      itemModel,
    },
    { upsert: true, new: true },
  );

  return result;
};

const removeFromCollectionFromDB = async (userId: string, collectionId: string) => {
  const result = await MyCollection.findOneAndDelete({
    _id: collectionId,
    userId: new Types.ObjectId(userId),
  });
  
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Item not found in your collection');
  }

  return result;
};

const getMyCollectionFromDB = async (userId: string, query: Record<string, unknown>) => {
  const myCollectionQuery = MyCollection.find({ userId: new Types.ObjectId(userId) })
    .populate('itemId');

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
  getMyCollectionFromDB,
};
