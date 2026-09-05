import status from "http-status";
import { Role, VendorStatus } from "../../../generated/prisma/enums";
import { VendorProfileModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { IRequestUser } from "../../types/request.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
  adminVendorFilterableFields,
  adminVendorSearchableFields,
  protectedVendorInclude,
  publicVendorFilterableFields,
  publicVendorSearchableFields,
  publicVendorSelect,
} from "./vendorProfile.constant";
import {
  ICreateVendorDocumentPayload,
  ICreateVendorProfilePayload,
  IUpdateVendorProfilePayload,
  IUpdateVendorStatusPayload,
} from "./vendorProfile.interface";

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const applyVendorProfile = async (userId: string, payload: ICreateVendorProfilePayload) => {
  const existingProfile = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (existingProfile) {
    throw new AppError(status.CONFLICT, "You already have a vendor profile");
  }

  const baseSlug = payload.storeSlug ? slugify(payload.storeSlug) : slugify(payload.storeName);

  // Ensure unique slug
  let storeSlug = baseSlug;
  const existingSlug = await prisma.vendorProfile.findUnique({
    where: { storeSlug },
  });

  if (existingSlug) {
    storeSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
  }

  return await prisma.$transaction(async (tx) => {
    const createdProfile = await tx.vendorProfile.create({
      data: {
        userId,
        storeName: payload.storeName,
        storeSlug,
        storeLogo: payload.storeLogo || null,
        storeBanner: payload.storeBanner || null,
        description: payload.description || null,
        bankAccountName: payload.bankAccountName || null,
        bankAccountNumber: payload.bankAccountNumber || null,
        bankName: payload.bankName || null,
        status: VendorStatus.PENDING,
        documents:
          payload.documents && payload.documents.length > 0
            ? {
                create: payload.documents.map((doc) => ({
                  type: doc.type,
                  url: doc.url,
                })),
              }
            : undefined,
      },
      include: {
        documents: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Set user's tenantId to the new store profile id
    await tx.user.update({
      where: { id: userId },
      data: {
        tenantId: createdProfile.id,
      },
    });

    return createdProfile;
  });
};

const getMyVendorProfile = async (userId: string) => {
  const vendorProfile = await prisma.vendorProfile.findUnique({
    where: { userId },
    include: protectedVendorInclude,
  });

  if (!vendorProfile) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found for this user");
  }

  return vendorProfile;
};

const updateMyVendorProfile = async (userId: string, payload: IUpdateVendorProfilePayload) => {
  const vendorProfile = await prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendorProfile) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  let storeSlug = vendorProfile.storeSlug;
  if (payload.storeSlug && payload.storeSlug !== vendorProfile.storeSlug) {
    const newSlug = slugify(payload.storeSlug);
    const existing = await prisma.vendorProfile.findUnique({
      where: { storeSlug: newSlug },
    });
    if (existing && existing.id !== vendorProfile.id) {
      throw new AppError(status.CONFLICT, "A store with this slug already exists");
    }
    storeSlug = newSlug;
  }

  const updatedProfile = await prisma.vendorProfile.update({
    where: { id: vendorProfile.id },
    data: {
      ...(payload.storeName !== undefined && { storeName: payload.storeName }),
      storeSlug,
      ...(payload.storeLogo !== undefined && { storeLogo: payload.storeLogo }),
      ...(payload.storeBanner !== undefined && { storeBanner: payload.storeBanner }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.bankAccountName !== undefined && { bankAccountName: payload.bankAccountName }),
      ...(payload.bankAccountNumber !== undefined && { bankAccountNumber: payload.bankAccountNumber }),
      ...(payload.bankName !== undefined && { bankName: payload.bankName }),
    },
    include: {
      documents: true,
    },
  });

  return updatedProfile;
};

const getAllVendorsPublic = async (queryParams: IQueryParams) => {
  const vendorQuery = new QueryBuilder<Record<string, unknown>>(prisma.vendorProfile, queryParams, {
    searchableFields: publicVendorSearchableFields,
    filterableFields: publicVendorFilterableFields,
  })
    .where({ status: VendorStatus.APPROVED })
    .search()
    .filter()
    .sort()
    .paginate()
    .select(publicVendorSelect);

  return await vendorQuery.execute();
};

const getVendorBySlug = async (slug: string, requester?: IRequestUser) => {
  const isPrivileged = requester && (requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN);

  // If Admin/SuperAdmin, return full profile
  if (isPrivileged) {
    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { storeSlug: slug },
      include: protectedVendorInclude,
    });
    if (!vendorProfile) {
      throw new AppError(status.NOT_FOUND, "Vendor store not found");
    }
    return vendorProfile;
  }

  // If authenticated user is the store owner, return full profile
  if (requester) {
    const isOwner = await prisma.vendorProfile.findFirst({
      where: { storeSlug: slug, userId: requester.userId },
      include: protectedVendorInclude,
    });
    if (isOwner) {
      return isOwner;
    }
  }

  // Public / non-owner: strictly return sanitized public fields of APPROVED vendor
  const publicVendor = await prisma.vendorProfile.findFirst({
    where: { storeSlug: slug, status: VendorStatus.APPROVED },
    select: publicVendorSelect,
  });

  if (!publicVendor) {
    throw new AppError(status.NOT_FOUND, "Vendor store not found");
  }

  return publicVendor;
};

const getAllVendorsAdmin = async (queryParams: IQueryParams) => {
  const vendorQuery = new QueryBuilder<VendorProfileModel>(prisma.vendorProfile, queryParams, {
    searchableFields: adminVendorSearchableFields,
    filterableFields: adminVendorFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include(protectedVendorInclude);

  return await vendorQuery.execute();
};

const getVendorById = async (id: string, requester?: IRequestUser) => {
  const isPrivileged = requester && (requester.role === Role.ADMIN || requester.role === Role.SUPER_ADMIN);

  // If Admin/SuperAdmin, return complete protected profile
  if (isPrivileged) {
    const vendorProfile = await prisma.vendorProfile.findUnique({
      where: { id },
      include: protectedVendorInclude,
    });
    if (!vendorProfile) {
      throw new AppError(status.NOT_FOUND, "Vendor profile not found");
    }
    return vendorProfile;
  }

  // If authenticated user is the store owner, return complete protected profile
  if (requester) {
    const isOwner = await prisma.vendorProfile.findFirst({
      where: { id, userId: requester.userId },
      include: protectedVendorInclude,
    });
    if (isOwner) {
      return isOwner;
    }
  }

  // Public / non-owner: strictly return sanitized public fields of APPROVED vendor
  const publicVendor = await prisma.vendorProfile.findFirst({
    where: { id, status: VendorStatus.APPROVED },
    select: publicVendorSelect,
  });

  if (!publicVendor) {
    throw new AppError(status.NOT_FOUND, "Vendor store not found");
  }

  return publicVendor;
};

const updateVendorStatus = async (id: string, payload: IUpdateVendorStatusPayload) => {
  const vendorProfile = await prisma.vendorProfile.findUnique({
    where: { id },
  });

  if (!vendorProfile) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  return await prisma.$transaction(async (tx) => {
    const updatedProfile = await tx.vendorProfile.update({
      where: { id },
      data: {
        status: payload.status,
        ...(payload.commissionRate !== undefined && { commissionRate: payload.commissionRate }),
      },
      include: {
        documents: true,
        owner: true,
      },
    });

    // If APPROVED: grant VENDOR role and sync tenantId
    if (payload.status === VendorStatus.APPROVED) {
      await tx.user.update({
        where: { id: vendorProfile.userId },
        data: {
          role: Role.VENDOR,
          tenantId: id,
          isOwner: true,
        },
      });
    }

    return updatedProfile;
  });
};

const addDocument = async (userId: string, vendorId: string, payload: ICreateVendorDocumentPayload, userRole: Role) => {
  const vendorProfile = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
  });

  if (!vendorProfile) {
    throw new AppError(status.NOT_FOUND, "Vendor profile not found");
  }

  // Ownership check
  if (userRole !== Role.ADMIN && userRole !== Role.SUPER_ADMIN && vendorProfile.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to add documents to this profile");
  }

  const document = await prisma.vendorDocument.create({
    data: {
      vendorId,
      type: payload.type,
      url: payload.url,
    },
  });

  return document;
};

const deleteDocument = async (userId: string, docId: string, userRole: Role) => {
  const document = await prisma.vendorDocument.findUnique({
    where: { id: docId },
    include: { vendor: true },
  });

  if (!document) {
    throw new AppError(status.NOT_FOUND, "Vendor document not found");
  }

  // Ownership check
  if (userRole !== Role.ADMIN && userRole !== Role.SUPER_ADMIN && document.vendor.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to delete this document");
  }

  const deletedDoc = await prisma.vendorDocument.delete({
    where: { id: docId },
  });

  return deletedDoc;
};

export const VendorProfileService = {
  applyVendorProfile,
  getMyVendorProfile,
  updateMyVendorProfile,
  getAllVendorsPublic,
  getVendorBySlug,
  getAllVendorsAdmin,
  getVendorById,
  updateVendorStatus,
  addDocument,
  deleteDocument,
};
