import { Router } from "express";
import { checkAuth } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import { ChatController } from "./chat.controller";
import { ChatValidation } from "./chat.validation";

const router = Router();

// Get list of conversations for logged-in user / vendor
router.get("/", checkAuth(), ChatController.getUserConversations);

// Create or fetch existing conversation
router.post(
  "/",
  checkAuth(),
  validateRequest(ChatValidation.createConversationSchema),
  ChatController.getOrCreateConversation,
);

// Get single conversation details
router.get("/:id", checkAuth(), ChatController.getConversationById);

// Get messages for conversation
router.get("/:id/messages", checkAuth(), ChatController.getMessages);

// Send a message in conversation
router.post(
  "/:id/messages",
  checkAuth(),
  validateRequest(ChatValidation.sendChatMessageSchema),
  ChatController.sendMessage,
);

// Mark conversation as read
router.patch("/:id/read", checkAuth(), ChatController.markConversationAsRead);

export const ChatRoutes = router;
