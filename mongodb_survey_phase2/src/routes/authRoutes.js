const express = require('express');
const {
  showRegisterPage,
  register,
  showLoginPage,
  login,
  logout
} = require('../controllers/authController');
const { redirectIfLoggedIn, requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/register', redirectIfLoggedIn, showRegisterPage);
router.post('/register', redirectIfLoggedIn, register);

router.get('/login', redirectIfLoggedIn, showLoginPage);
router.post('/login', redirectIfLoggedIn, login);

router.post('/logout', requireAuth, logout);

module.exports = router;
