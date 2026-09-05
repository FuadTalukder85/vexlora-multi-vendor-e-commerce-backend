import { Role } from "../../generated/prisma/enums";

export interface IRequestUser {
  userId: string;
  role: Role;
  email: string;
  tenantId?: string | null;
  isOwner?: boolean;
  isSuperAdmin?: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: IRequestUser;
      requestId: string;
    }
  }
}

export {};
