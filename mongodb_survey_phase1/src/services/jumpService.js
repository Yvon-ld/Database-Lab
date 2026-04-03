function findQuestionById(survey, questionId) {
  return survey.questions.find((question) => question.questionId === questionId);
}

function getSequentialNextQuestionId(survey, currentQuestionId) {
  const currentIndex = survey.questionOrder.indexOf(currentQuestionId);
  if (currentIndex === -1) return null;
  return survey.questionOrder[currentIndex + 1] || null;
}

function getOptionLabel(question, optionId) {
  const option = (question.options || []).find((item) => item.optionId === optionId);
  return option ? option.label : '';
}

function getMultiLabels(question, answerValue) {
  if (!Array.isArray(answerValue)) return [];
  return answerValue.map((optionId) => getOptionLabel(question, optionId));
}

function matchRule(question, rule, answerValue) {
  switch (rule.ruleType) {
    case 'single_equals': {
      const selectedLabel = getOptionLabel(question, answerValue);
      return answerValue === rule.value || selectedLabel === rule.value;
    }

    case 'multi_contains_any': {
      if (!Array.isArray(answerValue)) return false;
      const selectedLabels = getMultiLabels(question, answerValue);
      return (rule.values || []).some((item) =>
        answerValue.includes(item) || selectedLabels.includes(item)
      );
    }

    case 'multi_contains_all': {
      if (!Array.isArray(answerValue)) return false;
      const selectedLabels = getMultiLabels(question, answerValue);
      return (rule.values || []).every((item) =>
        answerValue.includes(item) || selectedLabels.includes(item)
      );
    }

    case 'number_gt':
      return Number(answerValue) > Number(rule.value);

    case 'number_gte':
      return Number(answerValue) >= Number(rule.value);

    case 'number_lt':
      return Number(answerValue) < Number(rule.value);

    case 'number_lte':
      return Number(answerValue) <= Number(rule.value);

    case 'number_between':
      return Number(answerValue) >= Number(rule.min) && Number(answerValue) <= Number(rule.max);

    case 'always':
      return true;

    default:
      return false;
  }
}

function getNextQuestionId(survey, currentQuestionId, answersMap) {
  const currentQuestion = findQuestionById(survey, currentQuestionId);
  if (!currentQuestion) return null;

  const answerValue = answersMap[currentQuestionId];
  const sortedRules = [...(currentQuestion.jumpRules || [])].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (matchRule(currentQuestion, rule, answerValue)) {
      return rule.targetQuestionId === '__SUBMIT__' ? null : rule.targetQuestionId;
    }
  }

  return getSequentialNextQuestionId(survey, currentQuestionId);
}

function computeVisitedQuestionIds(survey, answersMap) {
  const visited = [];
  let currentQuestionId = survey.questionOrder[0] || null;
  const safetySet = new Set();

  while (currentQuestionId && !safetySet.has(currentQuestionId)) {
    visited.push(currentQuestionId);
    safetySet.add(currentQuestionId);
    currentQuestionId = getNextQuestionId(survey, currentQuestionId, answersMap);
  }

  return visited;
}

module.exports = {
  getNextQuestionId,
  computeVisitedQuestionIds,
  getSequentialNextQuestionId
};
