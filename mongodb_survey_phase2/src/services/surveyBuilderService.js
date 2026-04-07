const {
  safeBoolean,
  safeNumber,
  createSurveyQuestionSnapshot
} = require('./questionBuilderService');

function normalizeJumpRules(rawRules = []) {
  return (rawRules || [])
    .filter((rule) => rule && rule.ruleType && rule.targetQuestionId)
    .map((rule, index) => ({
      priority: safeNumber(rule.priority) ?? index + 1,
      ruleType: rule.ruleType,
      value: rule.value !== '' ? rule.value : undefined,
      values: Array.isArray(rule.values)
        ? rule.values.filter((item) => item !== '')
        : typeof rule.values === 'string'
          ? rule.values.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      min: safeNumber(rule.min),
      max: safeNumber(rule.max),
      targetQuestionId: rule.targetQuestionId
    }));
}

function normalizeQuestions(rawQuestions = []) {
  return (rawQuestions || []).map((question, index) => ({
    ...createSurveyQuestionSnapshot(question, index),
    jumpRules: normalizeJumpRules(question.jumpRules)
  }));
}

function parseBuilderPayload(input) {
  if (!input) {
    throw new Error('Survey payload is required');
  }
  if (typeof input === 'string') {
    return JSON.parse(input);
  }
  return input;
}

function normalizeSurveyPayload(input) {
  const payload = parseBuilderPayload(input);
  const questions = normalizeQuestions(payload.questions || []);

  if (!payload.title || !String(payload.title).trim()) {
    throw new Error('Survey title is required');
  }

  if (questions.length === 0) {
    throw new Error('At least one question is required');
  }

  return {
    title: String(payload.title).trim(),
    description: String(payload.description || '').trim(),
    settings: {
      allowAnonymous: safeBoolean(payload.settings?.allowAnonymous),
      allowMultipleSubmissions: safeBoolean(payload.settings?.allowMultipleSubmissions),
      deadlineAt: payload.settings?.deadlineAt ? new Date(payload.settings.deadlineAt) : null
    },
    questions,
    questionOrder: questions.map((item) => item.questionId)
  };
}

module.exports = {
  normalizeSurveyPayload
};
