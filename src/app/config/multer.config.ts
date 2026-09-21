import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinaryUpload } from "./cloudinary.config";

const storage = new CloudinaryStorage({
  cloudinary: cloudinaryUpload,
  params: async (_req, file) => {
    const originalName = file.originalname;
    const extension = originalName.split(".").pop()?.toLowerCase();

    const fileNameWithoutExtension = originalName
      .split(".")
      .slice(0, -1)
      .join(".")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const uniqueName = Math.random().toString(36).substring(2) + "-" + Date.now() + "-" + fileNameWithoutExtension;

    const folder = extension === "pdf" ? "documents" : "images";

    return {
      folder: `e-commerce/${folder}`,
      public_id: uniqueName,
      resource_type: "auto",
    };
  },
});

export const multerUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file
  },
});
