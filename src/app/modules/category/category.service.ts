import status from "http-status";
import { CategoryModel } from "../../../generated/prisma/models";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../types/query.types";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { categoryFilterableFields, categorySearchableFields } from "./category.constant";
import { ICreateCategoryPayload, IUpdateCategoryPayload, ICategoryTreeNode } from "./category.interface";

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const createCategory = async (payload: ICreateCategoryPayload) => {
  const baseSlug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

  // Check if parent category exists
  if (payload.parentId) {
    const parentCategory = await prisma.category.findUnique({
      where: { id: payload.parentId },
    });
    if (!parentCategory) {
      throw new AppError(status.NOT_FOUND, "Parent category not found");
    }
  }

  // Ensure unique slug
  let slug = baseSlug;
  const existingCategory = await prisma.category.findUnique({
    where: { slug },
  });

  if (existingCategory) {
    slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
  }

  const category = await prisma.category.create({
    data: {
      name: payload.name,
      slug,
      parentId: payload.parentId || null,
      image: payload.image || null,
      commissionOverride: payload.commissionOverride !== undefined ? payload.commissionOverride : null,
      isActive: payload.isActive ?? true,
    },
    include: {
      parent: true,
      children: true,
    },
  });

  return category;
};

const getAllCategories = async (queryParams: IQueryParams) => {
  const categoryQuery = new QueryBuilder<CategoryModel>(prisma.category, queryParams, {
    searchableFields: categorySearchableFields,
    filterableFields: categoryFilterableFields,
  })
    .search()
    .filter()
    .sort()
    .paginate()
    .include({
      parent: true,
      children: true,
    });

  return await categoryQuery.execute();
};

const getCategoryTree = async () => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  // Build tree from flat category list
  const categoryMap = new Map<string, ICategoryTreeNode>();

  categories.forEach((cat) => {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      image: cat.image,
      commissionOverride: cat.commissionOverride,
      isActive: cat.isActive,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      children: [],
    });
  });

  const rootNodes: ICategoryTreeNode[] = [];

  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
};

const getCategoryById = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: true,
    },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  return category;
};

const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: true,
    },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  return category;
};

const updateCategory = async (id: string, payload: IUpdateCategoryPayload) => {
  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  // Prevent self-parenting
  if (payload.parentId) {
    if (payload.parentId === id) {
      throw new AppError(status.BAD_REQUEST, "Category cannot be its own parent");
    }

    const parentCategory = await prisma.category.findUnique({
      where: { id: payload.parentId },
    });
    if (!parentCategory) {
      throw new AppError(status.NOT_FOUND, "Parent category not found");
    }
  }

  // Handle slug change
  let slug = category.slug;
  if (payload.slug && payload.slug !== category.slug) {
    const newSlug = slugify(payload.slug);
    const existing = await prisma.category.findUnique({
      where: { slug: newSlug },
    });
    if (existing && existing.id !== id) {
      throw new AppError(status.CONFLICT, "Category with this slug already exists");
    }
    slug = newSlug;
  }

  const updatedCategory = await prisma.category.update({
    where: { id },
    data: {
      ...(payload.name !== undefined && { name: payload.name }),
      slug,
      ...(payload.parentId !== undefined && { parentId: payload.parentId }),
      ...(payload.image !== undefined && { image: payload.image }),
      ...(payload.commissionOverride !== undefined && { commissionOverride: payload.commissionOverride }),
      ...(payload.isActive !== undefined && { isActive: payload.isActive }),
    },
    include: {
      parent: true,
      children: true,
    },
  });

  return updatedCategory;
};

const deleteCategory = async (id: string) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { children: true },
  });

  if (!category) {
    throw new AppError(status.NOT_FOUND, "Category not found");
  }

  // Re-link children to parent category before deleting to prevent orphaned children
  await prisma.$transaction(async (tx) => {
    if (category.children.length > 0) {
      await tx.category.updateMany({
        where: { parentId: id },
        data: { parentId: category.parentId },
      });
    }

    await tx.category.delete({
      where: { id },
    });
  });

  return category;
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getCategoryTree,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
};
