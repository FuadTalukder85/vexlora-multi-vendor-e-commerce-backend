import { Role } from "../../generated/prisma/enums";

export interface IRequestUser {
  userId: string;
  role: Role;
  email: string;
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
