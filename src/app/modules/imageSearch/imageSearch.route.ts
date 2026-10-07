import { Router } from "express";
import multer from "multer";
import { rateLimiter } from "../../middlewares/rateLimiter";
import { ImageSearchController } from "./imageSearch.controller";

const router = Router();

// Configure in-memory multer upload for fast visual vector extraction
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/avif"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Supported formats: JPG, PNG, WEBP."));
    }
  },
});

// Search by uploaded image file or URL (Rate limited to 20 requests per minute)
router.post(
  "/",
  rateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    prefix: "ratelimit:imagesearch",
    message: "Image search rate limit exceeded. Please wait a moment before trying again.",
  }),
  memoryUpload.single("image"),
  ImageSearchController.searchByImage
);

// Find similar products based on an existing product ID
router.get(
  "/similar/:productId",
  rateLimiter({
    windowMs: 60 * 1000,
    max: 40,
    prefix: "ratelimit:similartoproduct",
  }),
  ImageSearchController.searchSimilarProducts
);

export const ImageSearchRoutes = router;
