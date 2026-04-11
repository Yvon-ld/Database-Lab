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
    pageTitle: '新建题目',
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

    req.session.success = '题目已保存到题库';
    return res.redirect(`/questions/${question._id}`);
  } catch (error) {
    req.session.error = `创建题目失败：${error.message}`;
    return res.redirect('/questions/new');
  }
}

async function showQuestionDetailPage(req, res) {
  const question = await loadAccessibleQuestion(req.params.id, req.currentUser._id);

  if (!question) {
    return res.status(404).render('partials/message', {
      title: '未找到题目',
      message: '请求的题目版本不存在，或你无权访问。'
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
      title: '未找到题目',
      message: '只有题目拥有者才能创建新版本。'
    });
  }

  res.render('questions/editor', {
    pageTitle: `基于 v${sourceQuestion.version} 创建新版本`,
    submitUrl: `/questions/${sourceQuestion._id}/versions`,
    question: sourceQuestion.toObject(),
    sourceQuestion: sourceQuestion.toObject()
  });
}

async function createQuestionVersion(req, res) {
  try {
    const sourceQuestion = await loadOwnedQuestion(req.params.id, req.currentUser._id);

    if (!sourceQuestion) {
      req.session.error = '未找到题目';
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

    req.session.success = '新题目版本已创建';
    return res.redirect(`/questions/${newQuestion._id}`);
  } catch (error) {
    req.session.error = `创建版本失败：${error.message}`;
    return res.redirect(`/questions/${req.params.id}`);
  }
}

async function shareQuestion(req, res) {
  const question = await loadOwnedQuestion(req.params.id, req.currentUser._id);

  if (!question) {
    req.session.error = '未找到题目';
    return res.redirect('/questions');
  }

  const username = String(req.body.username || '').trim();
  if (!username) {
    req.session.error = '用户名不能为空';
    return res.redirect(`/questions/${question._id}`);
  }

  const user = await User.findOne({ username });
  if (!user) {
    req.session.error = '未找到目标用户';
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

  req.session.success = `题目已共享给 ${user.username}`;
  return res.redirect(`/questions/${question._id}`);
}

async function createLibrary(req, res) {
  const name = String(req.body.name || '').trim();

  if (!name) {
    req.session.error = '分组名称不能为空';
    return res.redirect('/questions');
  }

  await QuestionLibrary.create({
    ownerId: req.currentUser._id,
    name,
    description: String(req.body.description || '').trim()
  });

  req.session.success = '题目分组已创建';
  return res.redirect('/questions');
}

async function addQuestionToLibrary(req, res) {
  const library = await QuestionLibrary.findOne({
    _id: req.params.libraryId,
    ownerId: req.currentUser._id
  });

  if (!library) {
    req.session.error = '未找到分组';
    return res.redirect('/questions');
  }

  const question = await loadAccessibleQuestion(req.body.questionId, req.currentUser._id);
  if (!question) {
    req.session.error = '未找到题目';
    return res.redirect('/questions');
  }

  const alreadyAdded = library.questionRootIds.some(
    (rootId) => String(rootId) === String(question.rootQuestionId)
  );

  if (!alreadyAdded) {
    library.questionRootIds.push(question.rootQuestionId);
    await library.save();
  }

  req.session.success = '题目已加入分组';
  return res.redirect(`/questions/${question._id}`);
}

async function removeQuestionFromLibrary(req, res) {
  const library = await QuestionLibrary.findOne({
    _id: req.params.libraryId,
    ownerId: req.currentUser._id
  });

  if (!library) {
    req.session.error = '未找到分组';
    return res.redirect('/questions');
  }

  library.questionRootIds = library.questionRootIds.filter(
    (rootId) => String(rootId) !== String(req.params.rootQuestionId)
  );
  await library.save();

  req.session.success = '题目已从分组中移除';
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
