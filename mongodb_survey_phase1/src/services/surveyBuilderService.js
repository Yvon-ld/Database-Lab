const crypto = require('crypto');

function safeBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function safeNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeOptions(rawOptions = []) {
  return (rawOptions || [])
    .filter((item) => item && String(item.label || '').trim())
    .map((item) => ({
      optionId: item.optionId || crypto.randomUUID(),
      label: String(item.label).trim()
    }));
}

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
  return (rawQuestions || []).map((question, index) => {
    const type = question.type;
    const normalizedQuestion = {
      questionId: question.questionId || crypto.randomUUID(),
      title: String(question.title || '').trim(),
      description: String(question.description || '').trim(),
      type,
      required: safeBoolean(question.required),
      order: index + 1,
      options: normalizeOptions(question.options),
      validation: {
        text: {
          minLength: safeNumber(question.validation?.text?.minLength),
          maxLength: safeNumber(question.validation?.text?.maxLength)
        },
        number: {
          min: safeNumber(question.validation?.number?.min),
          max: safeNumber(question.validation?.number?.max),
          integerOnly: safeBoolean(question.validation?.number?.integerOnly)
        },
        multi: {
          minSelected: safeNumber(question.validation?.multi?.minSelected),
          maxSelected: safeNumber(question.validation?.multi?.maxSelected),
          exactSelected: safeNumber(question.validation?.multi?.exactSelected)
        }
      },
      jumpRules: normalizeJumpRules(question.jumpRules)
    };

    return normalizedQuestion;
  });
}

function parseBuilderPayload(input) {
  if (!input) {
    throw new Error('问卷结构不能为空');
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
    throw new Error('问卷标题不能为空');
  }

  if (questions.length === 0) {
    throw new Error('至少需要一道题目');
  }

  questions.forEach((question) => {
    if (!question.title) {
      throw new Error('题目标题不能为空');
    }
    if (
      (question.type === 'single_choice' || question.type === 'multi_choice') &&
      (!question.options || question.options.length < 2)
    ) {
      throw new Error(`题目《${question.title}》至少需要两个选项`);
    }
  });

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
