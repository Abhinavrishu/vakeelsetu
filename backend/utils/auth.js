import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDB } from '../config/db.js';
import { users, lawyers, clients, refreshTokens } from '../database/schema.js';
import authMiddleware from '../middleware/middleware.js';

const router = express.Router();

// ========================
// Helper: Generate Tokens
// ========================

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '7d' }
  );
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

const storeRefreshToken = async (db, userId, token) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 15); // 15 days

  await db.insert(refreshTokens).values({
    token,
    userId,
    expiresAt,
  });
};

// ========================
// Register Route
// ========================
router.post('/register', async (req, res) => {
  const { name, email, password, role, ...extraData } = req.body;

  try {
    const db = getDB();

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (existingUser.length > 0) return res.status(400).json({ msg: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [user] = await db.insert(users).values({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
    }).returning();

    // Insert into role-specific table
    if (role === 'lawyer') {
      await db.insert(lawyers).values({
        userId: user.id,
        specialization: extraData.specialization || '',
        experience: extraData.experience || 0,
        profileImage: extraData.profileImage || '',
      });
    } else {
      await db.insert(clients).values({
        userId: user.id,
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(db, user.id, refreshToken);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Registration failed', error: err.message });
  }
});

// ========================
// Login Route
// ========================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const db = getDB();

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(db, user.id, refreshToken);

    res.json({
      accessToken,
      refreshToken,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Login failed', error: err.message });
  }
});

// ========================
// Refresh Token Route
// ========================
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ msg: 'Refresh token is required' });
  }

  try {
    const db = getDB();

    // Find the refresh token in DB
    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          eq(refreshTokens.revoked, false)
        )
      )
      .limit(1);

    if (!storedToken) {
      return res.status(401).json({ msg: 'Invalid or revoked refresh token' });
    }

    // Check if token is expired
    if (new Date() > new Date(storedToken.expiresAt)) {
      // Revoke the expired token
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.id, storedToken.id));

      return res.status(401).json({ msg: 'Refresh token has expired. Please login again.' });
    }

    // Get the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    // Revoke old refresh token (rotation)
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.id, storedToken.id));

    // Generate new token pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(db, user.id, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Token refresh failed', error: err.message });
  }
});

// ========================
// Logout Route
// ========================
router.post('/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const db = getDB();

    if (refreshToken) {
      // Revoke the specific refresh token
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(
          and(
            eq(refreshTokens.token, refreshToken),
            eq(refreshTokens.userId, req.user.id)
          )
        );
    } else {
      // Revoke ALL refresh tokens for this user
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.userId, req.user.id));
    }

    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Logout failed', error: err.message });
  }
});

// ========================
// Get Current User
// ========================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = getDB();

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        profileImage: users.profileImage,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load user', error: err.message });
  }
});

export default router;
