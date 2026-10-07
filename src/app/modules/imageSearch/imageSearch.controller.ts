import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ImageSearchService } from "./imageSearch.service";

const searchByImage = catchAsync(async (req: Request, res: Response) => {
  let result;
  const limit = req.query.limit ? Number(req.query.limit) : 24;
  const threshold = req.query.threshold ? Number(req.query.threshold) : 0.25;

  // Case 1: Uploaded file via Multer
  if (req.file) {
    const file = req.file;

    // Validate mime type
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/avif"];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new AppError(
        status.BAD_REQUEST,
        "Unsupported file type. Please upload a JPG, PNG, or WEBP image."
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new AppError(status.BAD_REQUEST, "File is too large. Maximum allowed size is 5MB.");
    }

    let buffer: Buffer;
    let queryPreview: string | undefined;

    if (file.buffer) {
      buffer = file.buffer;
      // Generate small thumbnail preview string
      queryPreview = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    } else if ((file as any).path) {
      // Cloudinary / disk path
      const imgPath = (file as any).path;
      queryPreview = imgPath;
      const resp = await fetch(imgPath);
      const arrayBuffer = await resp.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      throw new AppError(status.BAD_REQUEST, "Failed to process uploaded image file.");
    }

    result = await ImageSearchService.searchByImageBuffer(buffer, limit, threshold, queryPreview);
  } else if (req.body?.imageUrl || req.body?.imageData) {
    // Case 2: Base64 or Image URL in request body
    const imageSource = String(req.body.imageUrl || req.body.imageData);
    result = await ImageSearchService.searchByImageUrl(imageSource, limit, threshold);
  } else {
    throw new AppError(
      status.BAD_REQUEST,
      "Please provide an image file or an imageUrl to search for similar products."
    );
  }

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: `Found ${result.totalFound} visually similar products`,
    data: result,
  });
});

const searchSimilarProducts = catchAsync(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const limit = req.query.limit ? Number(req.query.limit) : 12;

  if (!productId || typeof productId !== "string") {
    throw new AppError(status.BAD_REQUEST, "Product ID is required");
  }

  const result = await ImageSearchService.searchByProductId(productId, limit);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Similar products retrieved successfully",
    data: result,
  });
});

export const ImageSearchController = {
  searchByImage,
  searchSimilarProducts,
};
