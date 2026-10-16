import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { getDB } from '../config/db.js';
import { users } from '../database/schema.js';

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ msg: 'No token. Authorization denied.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Ensure it's an access token, not a refresh token
    if (decoded.type !== 'access') {
      return res.status(401).json({ msg: 'Invalid token type' });
    }

    const db = getDB();

    // Select user without password
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
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) return res.status(401).json({ msg: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Access token expired', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ msg: 'Invalid token' });
  }
};

export default authMiddleware;
