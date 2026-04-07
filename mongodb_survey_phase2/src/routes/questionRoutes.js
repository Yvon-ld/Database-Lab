const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  listQuestions,
  showNewQuestionPage,
  createQuestion,
  showQuestionDetailPage,
  showNewVersionPage,
  createQuestionVersion,
  shareQuestion,
  createLibrary,
  addQuestionToLibrary,
  removeQuestionFromLibrary
} = require('../controllers/questionController');

const router = express.Router();

router.get('/', requireAuth, listQuestions);
router.get('/new', requireAuth, showNewQuestionPage);
router.post('/', requireAuth, createQuestion);

router.post('/libraries', requireAuth, createLibrary);
router.post('/libraries/:libraryId/questions', requireAuth, addQuestionToLibrary);
router.post('/libraries/:libraryId/questions/:rootQuestionId/remove', requireAuth, removeQuestionFromLibrary);

router.get('/:id', requireAuth, showQuestionDetailPage);
router.get('/:id/new-version', requireAuth, showNewVersionPage);
router.post('/:id/versions', requireAuth, createQuestionVersion);
router.post('/:id/share', requireAuth, shareQuestion);

module.exports = router;
