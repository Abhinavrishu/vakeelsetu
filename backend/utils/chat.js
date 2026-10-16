import express from 'express';
import { and, eq, neq } from 'drizzle-orm';
import { getDB } from '../config/db.js';
import { chatMessages } from '../database/schema.js';

const router = express.Router();

const buildConversationId = (clientId, lawyerId) => `${clientId}:${lawyerId}`;

const getChatScope = (clientId, lawyerId) => ({
  clientId: String(clientId).trim(),
  lawyerId: String(lawyerId).trim(),
});

router.get('/history', async (req, res) => {
  const { clientId, lawyerId, viewerId } = req.query;

  if (!clientId || !lawyerId) {
    return res.status(400).json({ msg: 'clientId and lawyerId are required' });
  }

  try {
    const db = getDB();
    const scope = getChatScope(clientId, lawyerId);
    const messages = await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.clientId, scope.clientId),
          eq(chatMessages.lawyerId, scope.lawyerId)
        )
      );

    const sortedMessages = messages.sort((left, right) => {
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });

    const unreadCount = viewerId
      ? sortedMessages.filter(
          (message) => message.senderId !== String(viewerId).trim() && !message.isRead
        ).length
      : sortedMessages.filter((message) => !message.isRead).length;

    res.json({
      conversationId: buildConversationId(scope.clientId, scope.lawyerId),
      messages: sortedMessages,
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load chat history', error: err.message });
  }
});

router.post('/messages', async (req, res) => {
  const { clientId, lawyerId, senderId, senderRole, content } = req.body;

  if (!clientId || !lawyerId || !senderId || !senderRole || !content?.trim()) {
    return res.status(400).json({ msg: 'clientId, lawyerId, senderId, senderRole and content are required' });
  }

  const trimmedContent = content.trim();
  const normalizedSenderRole = String(senderRole).trim();
  const recipientRole = normalizedSenderRole === 'client' ? 'lawyer' : 'client';
  const recipientId = normalizedSenderRole === 'client' ? String(lawyerId).trim() : String(clientId).trim();
  const scope = getChatScope(clientId, lawyerId);

  try {
    const db = getDB();
    const [savedMessage] = await db.insert(chatMessages).values({
      conversationId: buildConversationId(scope.clientId, scope.lawyerId),
      clientId: scope.clientId,
      lawyerId: scope.lawyerId,
      senderId: String(senderId).trim(),
      recipientId,
      senderRole: normalizedSenderRole,
      recipientRole,
      content: trimmedContent,
      isRead: false,
    }).returning();

    const io = req.app.get('io');
    if (io) {
      io.to(scope.clientId).emit('chat:message', savedMessage);
      io.to(scope.lawyerId).emit('chat:message', savedMessage);
    }

    res.status(201).json({ message: savedMessage });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to save message', error: err.message });
  }
});

router.patch('/read', async (req, res) => {
  const { clientId, lawyerId, readerId } = req.body;

  if (!clientId || !lawyerId || !readerId) {
    return res.status(400).json({ msg: 'clientId, lawyerId and readerId are required' });
  }

  try {
    const db = getDB();
    const scope = getChatScope(clientId, lawyerId);

    const unreadMessages = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.clientId, scope.clientId),
          eq(chatMessages.lawyerId, scope.lawyerId),
          eq(chatMessages.isRead, false),
          neq(chatMessages.senderId, String(readerId).trim())
        )
      );

    if (unreadMessages.length === 0) {
      return res.json({ updatedCount: 0, updatedMessageIds: [] });
    }

    const updatedAt = new Date();
    const updatedMessages = await db
      .update(chatMessages)
      .set({
        isRead: true,
        readAt: updatedAt,
      })
      .where(
        and(
          eq(chatMessages.clientId, scope.clientId),
          eq(chatMessages.lawyerId, scope.lawyerId),
          eq(chatMessages.isRead, false),
          neq(chatMessages.senderId, String(readerId).trim())
        )
      )
      .returning({
        id: chatMessages.id,
      });

    const io = req.app.get('io');
    if (io) {
      io.to(scope.clientId).emit('chat:read', {
        clientId: scope.clientId,
        lawyerId: scope.lawyerId,
        readerId: String(readerId).trim(),
        messageIds: updatedMessages.map((message) => message.id),
      });
      io.to(scope.lawyerId).emit('chat:read', {
        clientId: scope.clientId,
        lawyerId: scope.lawyerId,
        readerId: String(readerId).trim(),
        messageIds: updatedMessages.map((message) => message.id),
      });
    }

    res.json({
      updatedCount: updatedMessages.length,
      updatedMessageIds: updatedMessages.map((message) => message.id),
    });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update read status', error: err.message });
  }
});

export default router;
