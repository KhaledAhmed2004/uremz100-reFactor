import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { MyCollectionService } from './my-collection.service';

const addToCollection = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const guestId = req.guestId;
  const result = await MyCollectionService.addToCollectionInDB({
    userId: user?.id,
    guestId,
    ...req.body,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Added to collection successfully',
    data: result,
  });
});

const removeFromCollection = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const guestId = req.guestId;
  const { collectionId } = req.params;
  await MyCollectionService.removeFromCollectionFromDB({
    userId: user?.id,
    guestId,
    collectionId,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Removed from collection successfully',
    data: null,
  });
});

const removeFromCollectionBulk = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const guestId = req.guestId;
  const { itemIds } = req.body;

  const deletedCount = await MyCollectionService.removeFromCollectionBulkFromDB({
    userId: user?.id,
    guestId,
    itemIds,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${deletedCount} items removed from collection successfully`,
    data: {
      deletedCount,
      itemIds,
    },
  });
});

const getMyCollection = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const guestId = req.guestId;
  const result = await MyCollectionService.getMyCollectionFromDB(user?.id, guestId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My collection retrieved successfully',
    meta: result.pagination || undefined,
    data: result.data,
  });
});

export const MyCollectionController = {
  addToCollection,
  removeFromCollection,
  removeFromCollectionBulk,
  getMyCollection,
};
