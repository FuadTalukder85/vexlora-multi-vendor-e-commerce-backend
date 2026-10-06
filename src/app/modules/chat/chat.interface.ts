export interface ICreateConversationPayload {
  vendorId: string;
  productId?: string;
  subOrderId?: string;
  initialMessage?: string;
}

export interface ISendChatMessagePayload {
  text: string;
  attachments?: string[];
}

export interface IChatFilterOptions {
  searchTerm?: string;
  page?: number;
  limit?: number;
}
