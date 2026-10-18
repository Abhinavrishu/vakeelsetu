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
  expiresAt.setDate(expiresAt.getDate() + 15);

  await db.insert(refreshTokens).values({
    token,
    userId,
    expiresAt,
  });
};

const buildAuthUser = async (db, user) => {
  const baseUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    profileImage: user.profileImage || '',
    encryptionPublicKey: user.encryptionPublicKey || '',
    encryptedPrivateKeyBackup: user.encryptedPrivateKeyBackup || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.role !== 'lawyer') {
    return baseUser;
  }

  const [lawyerProfile] = await db
    .select({
      specialization: lawyers.specialization,
      experience: lawyers.experience,
      profileImage: lawyers.profileImage,
    })
    .from(lawyers)
    .where(eq(lawyers.userId, user.id))
    .limit(1);

  return {
    ...baseUser,
    specialization: lawyerProfile?.specialization || '',
    experience: lawyerProfile?.experience || 0,
    profileImage: lawyerProfile?.profileImage || baseUser.profileImage,
  };
};

// ========================
// Register Route
// ========================
router.post('/register', async (req, res) => {
  const { name, email, password, role, phone, profileImage, encryptionPublicKey, encryptedPrivateKeyBackup, ...extraData } = req.body;

  try {
    const db = getDB();

    // E2E chat is mandatory. The client generates the key pair and encrypts the
    // private-key backup before registration; this server never receives it in plaintext.
    if (!encryptionPublicKey) {
      return res.status(400).json({ msg: 'End-to-end encryption setup is required to create an account.' });
    }
    try {
      JSON.parse(encryptionPublicKey);
      if (encryptedPrivateKeyBackup) {
        const backup = JSON.parse(encryptedPrivateKeyBackup);
        if (backup?.v !== 1 || !backup.salt || !backup.iv || !backup.cipher) throw new Error('Invalid encryption identity');
      }
    } catch {
      return res.status(400).json({ msg: 'Invalid end-to-end encryption setup.' });
    }

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
      phone: phone?.trim() || '',
      profileImage: profileImage?.trim() || '',
      encryptionPublicKey: encryptionPublicKey?.trim() || '',
      encryptedPrivateKeyBackup: encryptedPrivateKeyBackup?.trim() || '',
    }).returning();

    // Insert into role-specific table
    if (role === 'lawyer') {
      await db.insert(lawyers).values({
        userId: user.id,
        specialization: extraData.specialization?.trim() || '',
        experience: Number(extraData.experience) || 0,
        profileImage: profileImage?.trim() || '',
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
    const authUser = await buildAuthUser(db, user);
    res.status(201).json({
      accessToken,
      refreshToken,
      user: authUser,
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

    const authUser = await buildAuthUser(db, user);

    res.json({
      accessToken,
      refreshToken,
      user: authUser,
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
        phone: users.phone,
        profileImage: users.profileImage,
        encryptionPublicKey: users.encryptionPublicKey,
        encryptedPrivateKeyBackup: users.encryptedPrivateKeyBackup,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json(await buildAuthUser(db, user));
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load user', error: err.message });
  }
});

router.get('/encryption-key/:userId', authMiddleware, async (req, res) => {
  try {
    const [user] = await getDB().select({ encryptionPublicKey: users.encryptionPublicKey })
      .from(users).where(eq(users.id, req.params.userId)).limit(1);
    if (!user) return res.status(404).json({ msg: 'User not found.' });
    // A legacy account has not initialized its device-only key yet. This is a
    // valid E2E state, not a missing route or plaintext fallback.
    if (!user.encryptionPublicKey) return res.json({ encryptionPublicKey: null, pendingDeviceSetup: true });
    res.json({ encryptionPublicKey: user.encryptionPublicKey, pendingDeviceSetup: false });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load encryption key', error: err.message });
  }
});

// Lets accounts created before E2E chat was introduced enroll without recreating
// their profile. The private key is encrypted in the browser before it reaches us.
router.put('/encryption-identity', authMiddleware, async (req, res) => {
  const { encryptionPublicKey, encryptedPrivateKeyBackup } = req.body || {};
  if (typeof encryptionPublicKey !== 'string' || !encryptionPublicKey) {
    return res.status(400).json({ msg: 'An encryption public key is required.' });
  }

  try {
    JSON.parse(encryptionPublicKey);
    if (encryptedPrivateKeyBackup) {
      const backup = JSON.parse(encryptedPrivateKeyBackup);
      if (backup?.v !== 1 || !backup.salt || !backup.iv || !backup.cipher) throw new Error('Invalid backup');
    }
    const [updatedUser] = await getDB().update(users).set({
      encryptionPublicKey,
      encryptedPrivateKeyBackup: encryptedPrivateKeyBackup || '',
      updatedAt: new Date(),
    }).where(eq(users.id, req.user.id)).returning();
    res.json(await buildAuthUser(getDB(), updatedUser));
  } catch {
    res.status(400).json({ msg: 'Invalid encryption identity.' });
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  const { name, phone, profileImage, specialization, experience } = req.body || {};

  if (!name?.trim()) {
    return res.status(400).json({ msg: 'Name is required' });
  }

  try {
    const db = getDB();
    const [updatedUser] = await db
      .update(users)
      .set({
        name: name.trim(),
        phone: typeof phone === 'string' ? phone.trim() : '',
        profileImage: typeof profileImage === 'string' ? profileImage.trim() : '',
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.id))
      .returning();

    if (req.user.role === 'lawyer') {
      await db
        .update(lawyers)
        .set({
          specialization: typeof specialization === 'string' ? specialization.trim() : '',
          experience: Number(experience) || 0,
          profileImage: typeof profileImage === 'string' ? profileImage.trim() : '',
          updatedAt: new Date(),
        })
        .where(eq(lawyers.userId, req.user.id));
    }

    res.json(await buildAuthUser(db, updatedUser));
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update profile', error: err.message });
  }
});

export default router;
