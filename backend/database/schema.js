import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';

// Role enum
const roleEnum = pgEnum('role', ['client', 'lawyer']);

// Users table
const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  password: text('password').notNull(),
  role: roleEnum('role').notNull(),
  emailVerified: timestamp('email_verified'),
  image: text('image'),
  phone: varchar('phone', { length: 255 }),
  profileImage: text('profile_image').default(''),
  encryptionPublicKey: text('encryption_public_key').default(''),
  encryptedPrivateKeyBackup: text('encrypted_private_key_backup').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Lawyers table
const lawyers = pgTable('lawyers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  specialization: varchar('specialization', { length: 255 }).notNull(),
  experience: integer('experience').notNull(),
  profileImage: text('profile_image').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Clients table
const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Refresh tokens table
const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  revoked: boolean('revoked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Chat messages table stores the full conversation history and read receipts.
const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: varchar('conversation_id', { length: 255 }).notNull(),
  clientId: text('client_id').notNull(),
  lawyerId: text('lawyer_id').notNull(),
  senderId: text('sender_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  senderRole: roleEnum('sender_role').notNull(),
  recipientRole: roleEnum('recipient_role').notNull(),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export { users, lawyers, clients, refreshTokens, chatMessages, roleEnum };
