const Question = require('../models/Question');
const QuestionLibrary = require('../models/QuestionLibrary');
const Survey = require('../models/Survey');
const Response = require('../models/Response');

function buildAccessFilter(userId) {
  return {
    $or: [
      { ownerId: userId },
      { sharedWithUserIds: userId }
    ]
  };
}

async function getAccessibleQuestionVersions(userId) {
  return Question.find(buildAccessFilter(userId)).sort({ rootQuestionId: 1, version: -1 }).lean();
}

function buildLatestQuestionMap(questionVersions) {
  const latestByRoot = new Map();
  questionVersions.forEach((question) => {
    const key = String(question.rootQuestionId || question._id);
    if (!latestByRoot.has(key)) {
      latestByRoot.set(key, question);
    }
  });
  return latestByRoot;
}

async function buildQuestionCatalog(userId) {
  const versionDocs = await getAccessibleQuestionVersions(userId);
  const latestByRoot = buildLatestQuestionMap(versionDocs);
  const libraries = await QuestionLibrary.find({ ownerId: userId }).sort({ createdAt: -1 }).lean();

  const latestQuestions = [...latestByRoot.values()].map((question) => ({
    ...question,
    isOwner: String(question.ownerId) === String(userId)
  }));
  const questionVersions = versionDocs.map((question) => ({
    ...question,
    isOwner: String(question.ownerId) === String(userId)
  }));

  const librariesWithQuestions = libraries.map((library) => ({
    ...library,
    questions: (library.questionRootIds || [])
      .map((rootId) => latestByRoot.get(String(rootId)))
      .filter(Boolean)
      .map((question) => ({
        ...question,
        isOwner: String(question.ownerId) === String(userId)
      }))
  }));

  return {
    questions: latestQuestions,
    questionVersions,
    libraries: librariesWithQuestions
  };
}

async function getQuestionHistory(rootQuestionId, userId) {
  return Question.find({
    rootQuestionId,
    ...buildAccessFilter(userId)
  }).sort({ version: 1 }).lean();
}

async function getQuestionUsage(rootQuestionId) {
  return Survey.find({ 'questions.sourceQuestionRootId': rootQuestionId })
    .select('title slug status version ownerId createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
}

async function buildQuestionCrossSurveyStats(rootQuestionId, question) {
  const responses = await Response.find({ 'answers.sourceQuestionRootId': rootQuestionId }).lean();
  const relatedAnswers = responses
    .flatMap((response) => response.answers || [])
    .filter((answer) => String(answer.sourceQuestionRootId) === String(rootQuestionId));

  if (question.type === 'single_choice') {
    return {
      totalResponses: relatedAnswers.length,
      optionCounts: (question.options || []).map((option) => ({
        optionId: option.optionId,
        label: option.label,
        count: relatedAnswers.filter((answer) => answer.value === option.optionId).length
      }))
    };
  }

  if (question.type === 'multi_choice') {
    return {
      totalResponses: relatedAnswers.length,
      optionCounts: (question.options || []).map((option) => ({
        optionId: option.optionId,
        label: option.label,
        count: relatedAnswers.filter(
          (answer) => Array.isArray(answer.value) && answer.value.includes(option.optionId)
        ).length
      }))
    };
  }

  if (question.type === 'number') {
    const numericValues = relatedAnswers
      .map((answer) => Number(answer.value))
      .filter((value) => !Number.isNaN(value));

    return {
      totalResponses: numericValues.length,
      average:
        numericValues.length > 0
          ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
          : null,
      values: numericValues
    };
  }

  return {
    totalResponses: relatedAnswers.length,
    values: relatedAnswers.map((answer) => answer.value)
  };
}

module.exports = {
  buildQuestionCatalog,
  getQuestionHistory,
  getQuestionUsage,
  buildQuestionCrossSurveyStats
};
