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

function normalizeQuestionDefinition(rawQuestion = {}) {
  const normalized = {
    title: String(rawQuestion.title || '').trim(),
    description: String(rawQuestion.description || '').trim(),
    type: rawQuestion.type,
    required: safeBoolean(rawQuestion.required),
    options: normalizeOptions(rawQuestion.options),
    validation: {
      text: {
        minLength: safeNumber(rawQuestion.validation?.text?.minLength)
      },
      number: {
        min: safeNumber(rawQuestion.validation?.number?.min),
        max: safeNumber(rawQuestion.validation?.number?.max),
        integerOnly: safeBoolean(rawQuestion.validation?.number?.integerOnly)
      },
      multi: {
        minSelected: safeNumber(rawQuestion.validation?.multi?.minSelected),
        maxSelected: safeNumber(rawQuestion.validation?.multi?.maxSelected),
        exactSelected: safeNumber(rawQuestion.validation?.multi?.exactSelected)
      }
    }
  };

  if (rawQuestion.validation?.text?.maxLength !== undefined) {
    normalized.validation.text.maxLength = safeNumber(rawQuestion.validation?.text?.maxLength);
  }

  validateQuestionDefinition(normalized);
  return normalized;
}

function validateQuestionDefinition(question) {
  if (!question.title) {
    throw new Error('Question title is required');
  }

  if (!['single_choice', 'multi_choice', 'text', 'number'].includes(question.type)) {
    throw new Error('Unsupported question type');
  }

  if (
    (question.type === 'single_choice' || question.type === 'multi_choice') &&
    question.options.length < 2
  ) {
    throw new Error(`Question "${question.title}" must contain at least two options`);
  }
}

function parseQuestionPayload(input) {
  if (!input) {
    throw new Error('Question payload is required');
  }

  if (typeof input === 'string') {
    return JSON.parse(input);
  }

  return input;
}

function normalizeQuestionPayload(input) {
  return normalizeQuestionDefinition(parseQuestionPayload(input));
}

function createSurveyQuestionSnapshot(rawQuestion = {}, index = 0) {
  const normalized = normalizeQuestionDefinition(rawQuestion);

  return {
    questionId: rawQuestion.questionId || crypto.randomUUID(),
    sourceQuestionId: rawQuestion.sourceQuestionId || null,
    sourceQuestionRootId: rawQuestion.sourceQuestionRootId || null,
    sourceQuestionVersion: safeNumber(rawQuestion.sourceQuestionVersion) ?? null,
    sourceLocked: safeBoolean(rawQuestion.sourceLocked),
    title: normalized.title,
    description: normalized.description,
    type: normalized.type,
    required: normalized.required,
    order: index + 1,
    options: normalized.options,
    validation: normalized.validation
  };
}

module.exports = {
  normalizeQuestionPayload,
  normalizeQuestionDefinition,
  createSurveyQuestionSnapshot,
  safeBoolean,
  safeNumber,
  normalizeOptions,
  validateQuestionDefinition
};
