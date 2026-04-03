const Survey = require('../models/Survey');
const Response = require('../models/Response');
const { generateSurveySlug } = require('../utils/slug');
const { normalizeSurveyPayload } = require('../services/surveyBuilderService');
const { computeVisitedQuestionIds } = require('../services/jumpService');
const { validateQuestionAnswer } = require('../services/validationService');
const { buildWholeSurveyStats, buildSingleQuestionStats } = require('../services/statsService');

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
  res.render('surveys/builder', {
    pageTitle: '创建问卷',
    submitUrl: '/surveys',
    survey: null
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
      message: '你没有权限查看这个问卷，或者问卷不存在'
    });
  }

  res.render('surveys/builder', {
    pageTitle: '编辑问卷',
    submitUrl: `/surveys/${survey._id}`,
    survey
  });
}

async function updateSurvey(req, res) {
  try {
    const survey = await Survey.findOne({
      _id: req.params.id,
      ownerId: req.currentUser._id
    });

    if (!survey) {
      req.session.error = '问卷不存在';
      return res.redirect('/dashboard');
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
    req.session.error = '问卷不存在';
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
    req.session.error = '问卷不存在';
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
      title: '问卷不存在',
      message: '你访问的问卷链接无效'
    });
  }

  if (!isSurveyAvailable(survey)) {
    return res.status(400).render('partials/message', {
      title: '问卷不可填写',
      message: '该问卷尚未发布、已关闭或已过截止时间'
    });
  }

  if (!survey.settings.allowAnonymous && !req.currentUser) {
    req.session.error = '该问卷需要登录后填写';
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
        title: '问卷不存在',
        message: '问卷不存在，无法提交'
      });
    }

    if (!isSurveyAvailable(survey)) {
      return res.status(400).render('partials/message', {
        title: '问卷不可提交',
        message: '该问卷当前不可提交'
      });
    }

    const currentUser = req.currentUser || null;
    if (!survey.settings.allowAnonymous && !currentUser) {
      req.session.error = '该问卷要求登录后填写';
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
            title: '重复提交受限',
            message: '该问卷不允许同一登录用户重复提交'
          });
        }
      } else {
        const anonymousSubmissionSet = getAnonymousSubmissionSet(req.session);
        if (anonymousSubmissionSet.has(String(survey._id))) {
          return res.status(400).render('partials/message', {
            title: '重复提交受限',
            message: '该问卷当前不允许同一匿名访客重复提交'
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
        answerErrors.push(`【${question.title}】${error}`);
      }

      return {
        questionId: question.questionId,
        questionType: question.type,
        value
      };
    });

    if (answerErrors.length > 0) {
      return res.status(400).render('partials/message', {
        title: '提交失败',
        message: answerErrors.join('；')
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
      message: '问卷提交成功，感谢你的填写'
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
      title: '问卷不存在',
      message: '无法查看统计结果'
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
      title: '问卷不存在',
      message: '无法查看题目统计'
    });
  }

  const stats = await buildWholeSurveyStats(survey._id, survey);
  const questionStats = buildSingleQuestionStats(stats, req.params.questionId);

  if (!questionStats) {
    return res.status(404).render('partials/message', {
      title: '题目不存在',
      message: '无法查看该题统计'
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
