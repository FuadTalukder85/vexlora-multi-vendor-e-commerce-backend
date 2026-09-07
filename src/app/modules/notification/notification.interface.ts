export interface ICreateNotificationPayload {
  userId: string;
  type: string;
  title?: string;
  message: string;
  link?: string;
}

export interface IBroadcastNotificationPayload {
  target: "ALL" | "VENDORS" | "CUSTOMERS";
  type: string;
  title?: string;
  message: string;
  link?: string;
}

export interface INotificationFilterParams {
  searchTerm?: string;
  type?: string;
  isRead?: boolean | string;
  userId?: string;
}
