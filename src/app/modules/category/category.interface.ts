export interface ICreateCategoryPayload {
  name: string;
  slug?: string;
  parentId?: string | null;
  image?: string | null;
  commissionOverride?: number | null;
  isActive?: boolean;
}

export interface IUpdateCategoryPayload {
  name?: string;
  slug?: string;
  parentId?: string | null;
  image?: string | null;
  commissionOverride?: number | null;
  isActive?: boolean;
}

export interface ICategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  image: string | null;
  commissionOverride: unknown | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  children: ICategoryTreeNode[];
}
