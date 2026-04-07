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
    pageTitle: 'Create Survey',
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

    req.session.success = 'Survey created successfully';
    return res.redirect(`/surveys/${survey._id}/edit`);
  } catch (error) {
    req.session.error = `Create survey failed: ${error.message}`;
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
      title: 'Survey not found',
      message: 'The requested survey does not exist or you do not have access.'
    });
  }

  const questionCatalog = await buildQuestionCatalog(req.currentUser._id);
  const surveyLocked = survey.status === 'published' || survey.status === 'closed';

  res.render('surveys/builder', {
    pageTitle: 'Edit Survey',
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
      req.session.error = 'Survey not found';
      return res.redirect('/dashboard');
    }

    if (survey.status === 'published' || survey.status === 'closed') {
      req.session.error = 'Published or closed surveys are locked to protect historical questions';
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

    req.session.success = 'Survey updated successfully';
    return res.redirect(`/surveys/${survey._id}/edit`);
  } catch (error) {
    req.session.error = `Update survey failed: ${error.message}`;
    return res.redirect(`/surveys/${req.params.id}/edit`);
  }
}

async function publishSurvey(req, res) {
  const survey = await Survey.findOne({
    _id: req.params.id,
    ownerId: req.currentUser._id
  });

  if (!survey) {
    req.session.error = 'Survey not found';
    return res.redirect('/dashboard');
  }

  survey.status = 'published';
  survey.publishedAt = new Date();
  await survey.save();

  req.session.success = 'Survey published';
  return res.redirect('/dashboard');
}

async function closeSurvey(req, res) {
  const survey = await Survey.findOne({
    _id: req.params.id,
    ownerId: req.currentUser._id
  });

  if (!survey) {
    req.session.error = 'Survey not found';
    return res.redirect('/dashboard');
  }

  survey.status = 'closed';
  survey.closedAt = new Date();
  await survey.save();

  req.session.success = 'Survey closed';
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
      title: 'Survey not found',
      message: 'The survey link is invalid.'
    });
  }

  if (!isSurveyAvailable(survey)) {
    return res.status(400).render('partials/message', {
      title: 'Survey unavailable',
      message: 'This survey is not open for submissions.'
    });
  }

  if (!survey.settings.allowAnonymous && !req.currentUser) {
    req.session.error = 'Please sign in before filling this survey';
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
        title: 'Survey not found',
        message: 'The survey does not exist.'
      });
    }

    if (!isSurveyAvailable(survey)) {
      return res.status(400).render('partials/message', {
        title: 'Submission blocked',
        message: 'This survey is not accepting submissions.'
      });
    }

    const currentUser = req.currentUser || null;
    if (!survey.settings.allowAnonymous && !currentUser) {
      req.session.error = 'Please sign in before filling this survey';
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
            title: 'Duplicate submission blocked',
            message: 'You have already submitted this survey.'
          });
        }
      } else {
        const anonymousSubmissionSet = getAnonymousSubmissionSet(req.session);
        if (anonymousSubmissionSet.has(String(survey._id))) {
          return res.status(400).render('partials/message', {
            title: 'Duplicate submission blocked',
            message: 'Anonymous duplicate submissions are disabled for this survey.'
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
        title: 'Submission failed',
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
      title: 'Submission successful',
      message: 'Your answers have been saved.'
    });
  } catch (error) {
    return res.status(500).render('partials/message', {
      title: 'Submission failed',
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
      title: 'Survey not found',
      message: 'Unable to load survey stats.'
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
      title: 'Survey not found',
      message: 'Unable to load question stats.'
    });
  }

  const stats = await buildWholeSurveyStats(survey._id, survey);
  const questionStats = buildSingleQuestionStats(stats, req.params.questionId);

  if (!questionStats) {
    return res.status(404).render('partials/message', {
      title: 'Question not found',
      message: 'Unable to load the requested question stats.'
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
