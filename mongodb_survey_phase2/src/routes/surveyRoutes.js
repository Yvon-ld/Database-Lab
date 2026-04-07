const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  showCreateSurveyPage,
  createSurvey,
  showEditSurveyPage,
  updateSurvey,
  publishSurvey,
  closeSurvey,
  showFillSurveyPage,
  submitSurvey,
  viewWholeSurveyStats,
  viewSingleQuestionStats
} = require('../controllers/surveyController');

const router = express.Router();

router.get('/new', requireAuth, showCreateSurveyPage);
router.post('/', requireAuth, createSurvey);

router.get('/:id/edit', requireAuth, showEditSurveyPage);
router.post('/:id', requireAuth, updateSurvey);
router.post('/:id/publish', requireAuth, publishSurvey);
router.post('/:id/close', requireAuth, closeSurvey);

router.get('/fill/:slug', showFillSurveyPage);
router.post('/fill/:slug/submit', submitSurvey);

router.get('/:id/stats', requireAuth, viewWholeSurveyStats);
router.get('/:id/stats/:questionId', requireAuth, viewSingleQuestionStats);

module.exports = router;
