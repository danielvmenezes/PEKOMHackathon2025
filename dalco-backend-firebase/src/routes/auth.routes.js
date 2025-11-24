const express = require('express');
const router = express.Router();
const { auth, db } = require('../config/firebase');
const { authenticateUser } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

/**
 * @route   POST /api/auth/verify
 * @desc    Verify Firebase ID token and create/update user in Firestore
 * @access  Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'ID token is required'
      });
    }

    // Verify token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Check if user exists
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    let userData;

    if (!userDoc.exists) {
      // Create new user
      userData = {
        uid,
        email,
        displayName: name || email.split('@')[0],
        photoURL: picture || null,
        role: 'owner', // First user becomes owner
        languagePreference: 'en',
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      await userRef.set(userData);
      logger.info(`New user created: ${uid}`);
    } else {
      // Update last login
      userData = userDoc.data();
      await userRef.update({
        lastLogin: new Date()
      });
    }

    res.json({
      success: true,
      user: {
        uid,
        email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        role: userData.role,
        organizationId: userData.organizationId || null,
        languagePreference: userData.languagePreference
      },
      message: userDoc.exists ? 'Login successful' : 'Account created successfully'
    });
  } catch (error) {
    logger.error(`Auth verify error: ${error.message}`);
    res.status(401).json({
      success: false,
      error: 'Invalid token or authentication failed'
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData = userDoc.data();

    // Get organization if exists
    let organization = null;
    if (userData.organizationId) {
      const orgDoc = await db.collection('organizations').doc(userData.organizationId).get();
      if (orgDoc.exists) {
        organization = {
          id: orgDoc.id,
          ...orgDoc.data()
        };
      }
    }

    res.json({
      success: true,
      user: {
        uid: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        role: userData.role,
        languagePreference: userData.languagePreference,
        organization,
        lastLogin: userData.lastLogin
      }
    });
  } catch (error) {
    logger.error(`Get user error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user profile'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { displayName, languagePreference } = req.body;

    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (languagePreference) updates.languagePreference = languagePreference;
    updates.updatedAt = new Date();

    await db.collection('users').doc(req.userId).update(updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      updates
    });
  } catch (error) {
    logger.error(`Profile update error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    // Update last activity
    await db.collection('users').doc(req.userId).update({
      lastActivity: new Date()
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

module.exports = router;