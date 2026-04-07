const Question = require('../models/Question');
const QuestionLibrary = require('../models/QuestionLibrary');
const User = require('../models/User');
const { normalizeQuestionPayload } = require('../services/questionBuilderService');
const {
  buildQuestionCatalog,
  getQuestionHistory,
  getQuestionUsage,
  buildQuestionCrossSurveyStats
} = require('../services/questionCatalogService');

async function loadAccessibleQuestion(questionId, userId) {
  return Question.findOne({
    _id: questionId,
    $or: [
      { ownerId: userId },
      { sharedWithUserIds: userId }
    ]
  });
}

async function loadOwnedQuestion(questionId, userId) {
  return Question.findOne({
    _id: questionId,
    ownerId: userId
  });
}

async function listQuestions(req, res) {
  const catalog = await buildQuestionCatalog(req.currentUser._id);
  res.render('questions/index', {
    catalog
  });
}

async function showNewQuestionPage(req, res) {
  res.render('questions/editor', {
    pageTitle: 'Create Question',
    submitUrl: '/questions',
    question: null,
    sourceQuestion: null
  });
}

async function createQuestion(req, res) {
  try {
    const normalized = normalizeQuestionPayload(req.body.questionPayload);
    const question = await Question.create({
      ownerId: req.currentUser._id,
      ...normalized
    });

    req.session.success = 'Question saved to the question bank';
    return res.redirect(`/questions/${question._id}`);
  } catch (error) {
    req.session.error = `Create question failed: ${error.message}`;
    return res.redirect('/questions/new');
  }
}

async function showQuestionDetailPage(req, res) {
  const question = await loadAccessibleQuestion(req.params.id, req.currentUser._id);

  if (!question) {
    return res.status(404).render('partials/message', {
      title: 'Question not found',
      message: 'The requested question version does not exist or is not accessible.'
    });
  }

  const history = await getQuestionHistory(question.rootQuestionId, req.currentUser._id);
  const usage = await getQuestionUsage(question.rootQuestionId);
  const crossSurveyStats = await buildQuestionCrossSurveyStats(question.rootQuestionId, question);
  const libraries = await QuestionLibrary.find({
    ownerId: req.currentUser._id
  }).lean();

  res.render('questions/detail', {
    question: question.toObject(),
    history,
    usage,
    libraries: libraries.map((library) => ({
      ...library,
      containsQuestion: (library.questionRootIds || []).some(
        (rootId) => String(rootId) === String(question.rootQuestionId)
      )
    })),
    crossSurveyStats,
    canManage: String(question.ownerId) === String(req.currentUser._id)
  });
}

async function showNewVersionPage(req, res) {
  const sourceQuestion = await loadOwnedQuestion(req.params.id, req.currentUser._id);

  if (!sourceQuestion) {
    return res.status(404).render('partials/message', {
      title: 'Question not found',
      message: 'Only the owner can create a new version.'
    });
  }

  res.render('questions/editor', {
    pageTitle: `Create New Version for v${sourceQuestion.version}`,
    submitUrl: `/questions/${sourceQuestion._id}/versions`,
    question: sourceQuestion.toObject(),
    sourceQuestion: sourceQuestion.toObject()
  });
}

async function createQuestionVersion(req, res) {
  try {
    const sourceQuestion = await loadOwnedQuestion(req.params.id, req.currentUser._id);

    if (!sourceQuestion) {
      req.session.error = 'Question not found';
      return res.redirect('/questions');
    }

    const normalized = normalizeQuestionPayload(req.body.questionPayload);
    const latestVersion = await Question.findOne({
      rootQuestionId: sourceQuestion.rootQuestionId
    }).sort({ version: -1 });

    const newQuestion = await Question.create({
      ownerId: req.currentUser._id,
      rootQuestionId: sourceQuestion.rootQuestionId,
      parentQuestionId: sourceQuestion._id,
      version: (latestVersion?.version || sourceQuestion.version) + 1,
      visibility: sourceQuestion.visibility,
      sharedWithUserIds: sourceQuestion.sharedWithUserIds,
      ...normalized
    });

    req.session.success = 'New question version created';
    return res.redirect(`/questions/${newQuestion._id}`);
  } catch (error) {
    req.session.error = `Create version failed: ${error.message}`;
    return res.redirect(`/questions/${req.params.id}`);
  }
}

async function shareQuestion(req, res) {
  const question = await loadOwnedQuestion(req.params.id, req.currentUser._id);

  if (!question) {
    req.session.error = 'Question not found';
    return res.redirect('/questions');
  }

  const username = String(req.body.username || '').trim();
  if (!username) {
    req.session.error = 'Username is required';
    return res.redirect(`/questions/${question._id}`);
  }

  const user = await User.findOne({ username });
  if (!user) {
    req.session.error = 'Target user not found';
    return res.redirect(`/questions/${question._id}`);
  }

  const history = await Question.find({ rootQuestionId: question.rootQuestionId });
  await Promise.all(history.map((item) => {
    if (!item.sharedWithUserIds.some((userId) => String(userId) === String(user._id))) {
      item.sharedWithUserIds.push(user._id);
    }
    item.visibility = 'shared';
    return item.save();
  }));

  req.session.success = `Question shared with ${user.username}`;
  return res.redirect(`/questions/${question._id}`);
}

async function createLibrary(req, res) {
  const name = String(req.body.name || '').trim();

  if (!name) {
    req.session.error = 'Library name is required';
    return res.redirect('/questions');
  }

  await QuestionLibrary.create({
    ownerId: req.currentUser._id,
    name,
    description: String(req.body.description || '').trim()
  });

  req.session.success = 'Question library created';
  return res.redirect('/questions');
}

async function addQuestionToLibrary(req, res) {
  const library = await QuestionLibrary.findOne({
    _id: req.params.libraryId,
    ownerId: req.currentUser._id
  });

  if (!library) {
    req.session.error = 'Library not found';
    return res.redirect('/questions');
  }

  const question = await loadAccessibleQuestion(req.body.questionId, req.currentUser._id);
  if (!question) {
    req.session.error = 'Question not found';
    return res.redirect('/questions');
  }

  const alreadyAdded = library.questionRootIds.some(
    (rootId) => String(rootId) === String(question.rootQuestionId)
  );

  if (!alreadyAdded) {
    library.questionRootIds.push(question.rootQuestionId);
    await library.save();
  }

  req.session.success = 'Question added to library';
  return res.redirect(`/questions/${question._id}`);
}

async function removeQuestionFromLibrary(req, res) {
  const library = await QuestionLibrary.findOne({
    _id: req.params.libraryId,
    ownerId: req.currentUser._id
  });

  if (!library) {
    req.session.error = 'Library not found';
    return res.redirect('/questions');
  }

  library.questionRootIds = library.questionRootIds.filter(
    (rootId) => String(rootId) !== String(req.params.rootQuestionId)
  );
  await library.save();

  req.session.success = 'Question removed from library';
  return res.redirect('/questions');
}

module.exports = {
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
};
