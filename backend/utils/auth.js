const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../database/model.user');
const Lawyer = require('../database/lawyer.model');
const Client = require('../database/database.client');
const authMiddleware = require('../middleware/middleware');

const router = express.Router();

// Register Route
router.post('/register', async (req, res) => {
  const { name, email, password, role, ...extraData } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role });

    if (role === 'lawyer') {
      await Lawyer.create({ userId: user._id, ...extraData });
    } else {
      await Client.create({ userId: user._id, ...extraData });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ msg: 'Registration failed', error: err.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ token,  email: user.email });
  } catch (err) {
    res.status(500).json({ msg: 'Login failed', error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password');
      res.json(user);
    } catch (err) {
      res.status(500).json({ msg: 'Failed to load user', error: err.message });
    }
  });

module.exports = router;
