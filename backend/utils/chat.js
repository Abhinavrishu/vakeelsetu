import express from 'express';
import { and, eq, ne, or } from 'drizzle-orm';
import { getDB } from '../config/db.js';
import { chatMessages, users } from '../database/schema.js';
import authMiddleware from '../middleware/middleware.js';

const router = express.Router();

const buildConversationId = (clientId, lawyerId) => `${clientId}:${lawyerId}`;

const getChatScope = (clientId, lawyerId) => ({
  clientId: String(clientId).trim(),
  lawyerId: String(lawyerId).trim(),
});

const isEncryptedEnvelope = (content) => {
  try {
    const value = JSON.parse(content);
    return value?.e2e === 1 && value?.v === 2 && typeof value.iv === 'string' && typeof value.cipher === 'string';
  } catch {
    return false;
  }
};

const authorizeConversation = async (req, res, next) => {
  const { clientId, lawyerId } = req.method === 'GET' ? req.query : req.body;
  const scope = getChatScope(clientId || '', lawyerId || '');
  if (!scope.clientId || !scope.lawyerId) return res.status(400).json({ msg: 'clientId and lawyerId are required' });
  if (req.user.id !== scope.clientId && req.user.id !== scope.lawyerId) return res.status(403).json({ msg: 'You are not a participant in this conversation.' });

  const participants = await getDB().select({ id: users.id, role: users.role }).from(users)
    .where(or(eq(users.id, scope.clientId), eq(users.id, scope.lawyerId)));
  const client = participants.find((user) => user.id === scope.clientId);
  const lawyer = participants.find((user) => user.id === scope.lawyerId);
  if (!client || !lawyer || client.role !== 'client' || lawyer.role !== 'lawyer') return res.status(400).json({ msg: 'Invalid client/lawyer conversation.' });
  req.chatScope = scope;
  next();
};

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const messages = await db.select().from(chatMessages)
      .where(req.user.role === 'lawyer' ? eq(chatMessages.lawyerId, req.user.id) : eq(chatMessages.clientId, req.user.id));
    const peerIds = [...new Set(messages.map((message) => req.user.role === 'lawyer' ? message.clientId : message.lawyerId))];
    if (!peerIds.length) return res.json({ conversations: [] });
    const people = await db.select({ id: users.id, name: users.name }).from(users).where(or(...peerIds.map((id) => eq(users.id, id))));
    const names = new Map(people.map((person) => [person.id, person.name]));
    res.json({ conversations: peerIds.map((peerId) => ({ peerId, peerName: names.get(peerId) || 'Unknown user' })) });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load conversations', error: err.message });
  }
});

router.get('/history', authMiddleware, authorizeConversation, async (req, res) => {
  const { clientId, lawyerId } = req.query;

  if (!clientId || !lawyerId) {
    return res.status(400).json({ msg: 'clientId and lawyerId are required' });
  }

  try {
    const db = getDB();
    const scope = req.chatScope;
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

    const unreadCount = sortedMessages.filter(
      (message) => message.senderId !== req.user.id && !message.isRead
    ).length;

    res.json({
      conversationId: buildConversationId(scope.clientId, scope.lawyerId),
      messages: sortedMessages,
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load chat history', error: err.message });
  }
});

router.post('/messages', authMiddleware, authorizeConversation, async (req, res) => {
  const { clientId, lawyerId, senderId, senderRole, content } = req.body;

  if (!clientId || !lawyerId || !senderId || !senderRole || !content?.trim()) {
    return res.status(400).json({ msg: 'clientId, lawyerId, senderId, senderRole and content are required' });
  }

  const trimmedContent = content.trim();
  const normalizedSenderRole = String(senderRole).trim();
  const recipientRole = normalizedSenderRole === 'client' ? 'lawyer' : 'client';
  const recipientId = normalizedSenderRole === 'client' ? String(lawyerId).trim() : String(clientId).trim();
  const scope = req.chatScope;

  if (String(senderId).trim() !== req.user.id || normalizedSenderRole !== req.user.role) {
    return res.status(403).json({ msg: 'Sender identity does not match your session.' });
  }
  if (!isEncryptedEnvelope(trimmedContent)) {
    return res.status(400).json({ msg: 'Messages must be end-to-end encrypted.' });
  }

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

router.patch('/read', authMiddleware, authorizeConversation, async (req, res) => {
  const { clientId, lawyerId, readerId } = req.body;

  if (!clientId || !lawyerId || !readerId) {
    return res.status(400).json({ msg: 'clientId, lawyerId and readerId are required' });
  }

  try {
    const db = getDB();
    if (String(readerId).trim() !== req.user.id) return res.status(403).json({ msg: 'Reader identity does not match your session.' });
    const scope = req.chatScope;

    const unreadMessages = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.clientId, scope.clientId),
          eq(chatMessages.lawyerId, scope.lawyerId),
          eq(chatMessages.isRead, false),
          ne(chatMessages.senderId, String(readerId).trim())
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
          ne(chatMessages.senderId, String(readerId).trim())
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
