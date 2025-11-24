const { auth, db } = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Verify Firebase ID token and attach user to request
 */
const authenticateUser = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Please include Bearer token in Authorization header.'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify token with Firebase
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Get user from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found in database'
      });
    }

    const userData = userDoc.data();

    // Check if user is active
    if (!userData.isActive) {
      return res.status(403).json({
        success: false,
        error: 'User account is deactivated'
      });
    }

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      ...userData
    };

    req.userId = decodedToken.uid;
    req.organizationId = userData.organizationId;

    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please login again.'
      });
    }

    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. Please login again.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Check if user has required role
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(idToken);
      
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          ...userDoc.data()
        };
        req.userId = decodedToken.uid;
        req.organizationId = userDoc.data().organizationId;
      }
    }
    
    next();
  } catch (error) {
    // Silently fail and continue
    next();
  }
};

module.exports = {
  authenticateUser,
  authorizeRole,
  optionalAuth
};