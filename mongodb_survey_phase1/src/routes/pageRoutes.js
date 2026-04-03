const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  listMySurveys,
  showFillSurveyPage,
  submitSurvey
} = require('../controllers/surveyController');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.currentUser) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/login');
});

router.get('/login', (req, res) => res.redirect('/auth/login'));
router.get('/register', (req, res) => res.redirect('/auth/register'));

router.get('/dashboard', requireAuth, listMySurveys);
router.get('/survey/:slug', showFillSurveyPage);
router.post('/survey/:slug/submit', submitSurvey);

module.exports = router;
