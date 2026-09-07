import status from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import { UserModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { userFilterableFields, userSearchableFields } from "./user.constant";
import { ICreateUserPayload, IUpdateMePayload, IUpdateUserPayload, IUpdateUserStatusPayload } from "./user.interface";

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, isDeleted: false },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User profile not found");
  }

  return user;
};

const updateMe = async (userId: string, payload: IUpdateMePayload) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, isDeleted: false },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User profile not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.phone !== undefined && { phone: payload.phone }),
      ...(payload.image !== undefined && { image: payload.image }),
    },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  return updatedUser;
};

const getAllUsers = async (queryParams: IQueryParams) => {
  const userQuery = new QueryBuilder<UserModel>(prisma.user, queryParams, {
    searchableFields: userSearchableFields,
    filterableFields: userFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      addresses: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    });

  return await userQuery.execute();
};

const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      accounts: {
        select: {
          id: true,
          providerId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return user;
};

const createUser = async (creatorId: string, payload: ICreateUserPayload) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new AppError(status.CONFLICT, "User with this email already exists");
  }

  let validCreatorId: string | undefined = undefined;
  if (creatorId) {
    const creatorExists = await prisma.user.findUnique({
      where: { id: creatorId },
    });
    if (creatorExists) {
      validCreatorId = creatorId;
    }
  }

  // If password provided, use Better Auth signUpEmail API to properly create credentials
  if (payload.password) {
    try {
      const createdAuthUser = await auth.api.signUpEmail({
        body: {
          email: payload.email,
          password: payload.password,
          name: payload.name,
        },
      });

      if (!createdAuthUser || !createdAuthUser.user) {
        throw new AppError(status.BAD_REQUEST, "Failed to create user credentials");
      }

      // Update custom fields on the created user
      const user = await prisma.user.update({
        where: { id: createdAuthUser.user.id },
        data: {
          role: payload.role || Role.CUSTOMER,
          status: payload.status || UserStatus.ACTIVE,
          phone: payload.phone,
          tenantId: payload.tenantId,
          isOwner: payload.isOwner ?? true,
          isSuperAdmin: payload.isSuperAdmin ?? false,
          createdById: validCreatorId,
        },
      });

      return user;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : "Failed to create user";
      throw new AppError(status.BAD_REQUEST, message);
    }
  }

  // Direct user creation (without password)
  const newUser = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      role: payload.role || Role.CUSTOMER,
      status: payload.status || UserStatus.ACTIVE,
      phone: payload.phone,
      tenantId: payload.tenantId,
      isOwner: payload.isOwner ?? true,
      isSuperAdmin: payload.isSuperAdmin ?? false,
      createdById: validCreatorId,
    },
  });

  return newUser;
};

const updateUser = async (id: string, payload: IUpdateUserPayload) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.phone !== undefined && { phone: payload.phone }),
      ...(payload.image !== undefined && { image: payload.image }),
      ...(payload.role !== undefined && { role: payload.role }),
      ...(payload.status !== undefined && { status: payload.status }),
      ...(payload.tenantId !== undefined && { tenantId: payload.tenantId }),
      ...(payload.isOwner !== undefined && { isOwner: payload.isOwner }),
      ...(payload.isSuperAdmin !== undefined && { isSuperAdmin: payload.isSuperAdmin }),
      ...(payload.emailVerified !== undefined && { emailVerified: payload.emailVerified }),
    },
    include: {
      addresses: true,
    },
  });

  return updatedUser;
};

const updateUserStatus = async (id: string, payload: IUpdateUserStatusPayload) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      status: payload.status,
    },
  });

  // If user is no longer ACTIVE, revoke all active sessions immediately
  if (payload.status !== UserStatus.ACTIVE) {
    await prisma.session.deleteMany({
      where: { userId: id },
    });
  }

  return updatedUser;
};

const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // Soft delete
  const deletedUser = await prisma.user.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      status: UserStatus.DELETED,
    },
  });

  // Invalidate all active sessions
  await prisma.session.deleteMany({
    where: { userId: id },
  });

  return deletedUser;
};

export const UserService = {
  getMe,
  updateMe,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
};
