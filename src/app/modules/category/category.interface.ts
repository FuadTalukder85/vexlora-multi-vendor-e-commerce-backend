export interface ICreateCategoryPayload {
  name: string;
  slug?: string;
  parentId?: string | null;
  image?: string | null;
  commissionOverride?: number | null;
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface IUpdateCategoryPayload {
  name?: string;
  slug?: string;
  parentId?: string | null;
  image?: string | null;
  commissionOverride?: number | null;
  isActive?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | null;
}

export interface ICategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  image: string | null;
  commissionOverride: unknown | null;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  children: ICategoryTreeNode[];
}

