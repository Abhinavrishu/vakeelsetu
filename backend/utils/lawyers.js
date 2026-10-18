import express from 'express';
import { desc, eq } from 'drizzle-orm';
import { getDB } from '../config/db.js';
import { lawyers, users } from '../database/schema.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const db = getDB();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        specialization: lawyers.specialization,
        experience: lawyers.experience,
        userProfileImage: users.profileImage,
        lawyerProfileImage: lawyers.profileImage,
        createdAt: users.createdAt,
      })
      .from(lawyers)
      .innerJoin(users, eq(lawyers.userId, users.id))
      .orderBy(desc(users.createdAt));

    const formattedLawyers = rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.specialization || 'General',
      specialization: row.specialization || 'General',
      experience: row.experience || 0,
      charges: Math.max(1000, (Number(row.experience) || 0) * 500),
      verified: true,
      photo: row.lawyerProfileImage || row.userProfileImage || 'https://via.placeholder.com/100',
    }));

    res.json({ lawyers: formattedLawyers });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to load lawyers', error: err.message });
  }
});

export default router;