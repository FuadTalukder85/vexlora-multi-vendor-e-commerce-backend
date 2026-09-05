import { Response } from "express";

interface IResponseData<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const sendResponse = <T>(res: Response, responseData: IResponseData<T>) => {
  const { statusCode, success, message, data, meta } = responseData;

  res.status(statusCode).json({
    success,
    statusCode,
    message,
    data,
    meta,
  });
};
