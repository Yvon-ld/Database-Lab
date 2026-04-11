const Survey = require('../models/Survey');
const Response = require('../models/Response');
const { generateSurveySlug } = require('../utils/slug');
const { normalizeSurveyPayload } = require('../services/surveyBuilderService');
const { computeVisitedQuestionIds } = require('../services/jumpService');
const { validateQuestionAnswer } = require('../services/validationService');
const { buildWholeSurveyStats, buildSingleQuestionStats } = require('../services/statsService');
const { buildQuestionCatalog } = require('../services/questionCatalogService');

async function listMySurveys(req, res) {
  const surveys = await Survey.find({ ownerId: req.currentUser._id }).sort({ createdAt: -1 }).lean();

  const surveyIds = surveys.map((item) => item._id);
  const responseCounts = await Response.aggregate([
    { $match: { surveyId: { $in: surveyIds } } },
    { $group: { _id: '$surveyId', count: { $sum: 1 } } }
  ]);

  const countMap = Object.fromEntries(responseCounts.map((item) => [String(item._id), item.count]));

  res.render('surveys/dashboard', {
    surveys: surveys.map((survey) => ({
      ...survey,
      responseCount: countMap[String(survey._id)] || 0
    }))
  });
}

async function showCreateSurveyPage(req, res) {
  const questionCatalog = await buildQuestionCatalog(req.currentUser._id);

  res.render('surveys/builder', {
    pageTitle: '新建问卷',
    submitUrl: '/surveys',
    survey: null,
    surveyLocked: false,
    questionCatalog
  });
}

async function createSurvey(req, res) {
  try {
    const normalized = normalizeSurveyPayload(req.body.builderPayload);
    const survey = await Survey.create({
      ownerId: req.currentUser._id,
      ...normalized,
      slug: generateSurveySlug()
    });

    req.session.success = '问卷创建成功';
    return res.redirect(`/surveys/${survey._id}/edit`);
  } catch (error) {
    req.session.error = `创建问卷失败：${error.message}`;
    return res.redirect('/surveys/new');
  }
}

async function showEditSurveyPage(req, res) {
  const survey = await Survey.findOne({
    _id: req.params.id,
    ownerId: req.currentUser._id
  }).lean();

  if (!survey) {
    return res.status(404).render('partials/message', {
      title: '未找到问卷',
      message: '请求的问卷不存在，或你无权访问。'
    });
  }

  const questionCatalog = await buildQuestionCatalog(req.currentUser._id);
  const surveyLocked = survey.status === 'published' || survey.status === 'closed';

  res.render('surveys/builder', {
    pageTitle: '编辑问卷',
    submitUrl: `/surveys/${survey._id}`,
    survey,
    surveyLocked,
    questionCatalog
  });
}

async function updateSurvey(req, res) {
  try {
    const survey = await Survey.findOne({
      _id: req.params.id,
      ownerId: req.currentUser._id
    });

    if (!survey) {
      req.session.error = '未找到问卷';
      return res.redirect('/dashboard');
    }

    if (survey.status === 'published' || survey.status === 'closed') {
      req.session.error = '问卷已发布或已关闭，为保护历史版本，当前内容已锁定';
      return res.redirect(`/surveys/${survey._id}/edit`);
    }

    const normalized = normalizeSurveyPayload(req.body.builderPayload);

    survey.title = normalized.title;
    survey.description = normalized.description;
    survey.settings = normalized.settings;
    survey.questions = normalized.questions;
    survey.questionOrder = normalized.questionOrder;
    survey.version += 1;

    await survey.save();

    req.session.success = '问卷更新成功';
    return res.redirect(`/surveys/${survey._id}/edit`);
  } catch (error) {
    req.session.error = `更新问卷失败：${error.message}`;
    return res.redirect(`/surveys/${req.params.id}/edit`);
  }
}

async function publishSurvey(req, res) {
  const survey = await Survey.findOne({
    _id: req.params.id,
    ownerId: req.currentUser._id
  });

  if (!survey) {
    req.session.error = '未找到问卷';
    return res.redirect('/dashboard');
  }

  survey.status = 'published';
  survey.publishedAt = new Date();
  await survey.save();

  req.session.success = '问卷已发布';
  return res.redirect('/dashboard');
}

async function closeSurvey(req, res) {
  const survey = await Survey.findOne({
    _id: req.params.id,
    ownerId: req.currentUser._id
  });

  if (!survey) {
    req.session.error = '未找到问卷';
    return res.redirect('/dashboard');
  }

  survey.status = 'closed';
  survey.closedAt = new Date();
  await survey.save();

  req.session.success = '问卷已关闭';
  return res.redirect('/dashboard');
}

function isSurveyAvailable(survey) {
  if (survey.status !== 'published') return false;
  if (survey.settings?.deadlineAt && new Date(survey.settings.deadlineAt) < new Date()) return false;
  return true;
}

function getAnonymousSubmissionSet(session) {
  const surveyIds = session.anonymousSubmittedSurveyIds || [];
  return new Set(surveyIds.map(String));
}

async function showFillSurveyPage(req, res) {
  const survey = await Survey.findOne({ slug: req.params.slug }).lean();

  if (!survey) {
    return res.status(404).render('partials/message', {
      title: '未找到问卷',
      message: '问卷链接无效。'
    });
  }

  if (!isSurveyAvailable(survey)) {
    return res.status(400).render('partials/message', {
      title: '问卷不可用',
      message: '这份问卷当前未开放提交。'
    });
  }

  if (!survey.settings.allowAnonymous && !req.currentUser) {
    req.session.error = '请先登录后再填写这份问卷';
    return res.redirect('/auth/login');
  }

  res.render('surveys/fill', {
    survey,
    submitUrl: `/survey/${survey.slug}/submit`
  });
}

async function submitSurvey(req, res) {
  try {
    const survey = await Survey.findOne({ slug: req.params.slug });

    if (!survey) {
      return res.status(404).render('partials/message', {
        title: '未找到问卷',
        message: '这份问卷不存在。'
      });
    }

    if (!isSurveyAvailable(survey)) {
      return res.status(400).render('partials/message', {
        title: '提交被阻止',
        message: '这份问卷当前不接受提交。'
      });
    }

    const currentUser = req.currentUser || null;
    if (!survey.settings.allowAnonymous && !currentUser) {
      req.session.error = '请先登录后再填写这份问卷';
      return res.redirect('/auth/login');
    }

    if (!survey.settings.allowMultipleSubmissions) {
      if (currentUser) {
        const existing = await Response.findOne({
          surveyId: survey._id,
          respondentId: currentUser._id
        });

        if (existing) {
          return res.status(400).render('partials/message', {
            title: '重复提交被阻止',
            message: '你已经提交过这份问卷。'
          });
        }
      } else {
        const anonymousSubmissionSet = getAnonymousSubmissionSet(req.session);
        if (anonymousSubmissionSet.has(String(survey._id))) {
          return res.status(400).render('partials/message', {
            title: '重复提交被阻止',
            message: '这份问卷已关闭匿名重复提交。'
          });
        }
      }
    }

    const answersMap = typeof req.body.answersPayload === 'string'
      ? JSON.parse(req.body.answersPayload)
      : (req.body.answersPayload || {});

    const visitedQuestionIds = computeVisitedQuestionIds(survey, answersMap);
    const answerErrors = [];

    const normalizedAnswers = visitedQuestionIds.map((questionId) => {
      const question = survey.questions.find((item) => item.questionId === questionId);
      const value = answersMap[questionId];
      const error = validateQuestionAnswer(question, value);

      if (error) {
        answerErrors.push(`"${question.title}": ${error}`);
      }

      return {
        questionId: question.questionId,
        sourceQuestionId: question.sourceQuestionId || null,
        sourceQuestionRootId: question.sourceQuestionRootId || null,
        sourceQuestionVersion: question.sourceQuestionVersion || null,
        questionTitleSnapshot: question.title,
        questionType: question.type,
        value
      };
    });

    if (answerErrors.length > 0) {
      return res.status(400).render('partials/message', {
        title: '提交失败',
        message: answerErrors.join('; ')
      });
    }

    await Response.create({
      surveyId: survey._id,
      surveyTitleSnapshot: survey.title,
      surveyVersion: survey.version,
      respondentId: currentUser ? currentUser._id : null,
      respondentType: currentUser ? 'user' : 'anonymous',
      visitedQuestionIds,
      answers: normalizedAnswers
    });

    if (!currentUser && !survey.settings.allowMultipleSubmissions) {
      const anonymousSubmissionSet = getAnonymousSubmissionSet(req.session);
      anonymousSubmissionSet.add(String(survey._id));
      req.session.anonymousSubmittedSurveyIds = [...anonymousSubmissionSet];
    }

    return res.render('partials/message', {
      title: '提交成功',
      message: '你的答案已保存。'
    });
  } catch (error) {
    return res.status(500).render('partials/message', {
      title: '提交失败',
      message: error.message
    });
  }
}

async function viewWholeSurveyStats(req, res) {
  const survey = await Survey.findOne({
    _id: req.params.id,
    ownerId: req.currentUser._id
  }).lean();

  if (!survey) {
    return res.status(404).render('partials/message', {
      title: '未找到问卷',
      message: '无法加载问卷统计。'
    });
  }

  const stats = await buildWholeSurveyStats(survey._id, survey);

  res.render('stats/surveyStats', {
    survey,
    stats
  });
}

async function viewSingleQuestionStats(req, res) {
  const survey = await Survey.findOne({
    _id: req.params.id,
    ownerId: req.currentUser._id
  }).lean();

  if (!survey) {
    return res.status(404).render('partials/message', {
      title: '未找到问卷',
      message: '无法加载单题统计。'
    });
  }

  const stats = await buildWholeSurveyStats(survey._id, survey);
  const questionStats = buildSingleQuestionStats(stats, req.params.questionId);

  if (!questionStats) {
    return res.status(404).render('partials/message', {
      title: '未找到题目',
      message: '无法加载请求的题目统计。'
    });
  }

  res.render('stats/questionStats', {
    survey,
    questionStats
  });
}

module.exports = {
  listMySurveys,
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
};
