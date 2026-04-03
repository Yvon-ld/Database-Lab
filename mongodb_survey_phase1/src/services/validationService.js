function isEmpty(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function validateSingleChoice(question, answerValue) {
  if (question.required && isEmpty(answerValue)) {
    return '该单选题为必答题';
  }
  if (!isEmpty(answerValue)) {
    const validOptionIds = (question.options || []).map((item) => item.optionId);
    if (!validOptionIds.includes(answerValue)) {
      return '单选题答案不合法';
    }
  }
  return null;
}

function validateMultiChoice(question, answerValue) {
  if (!isEmpty(answerValue) && !Array.isArray(answerValue)) {
    return '多选题答案格式错误';
  }

  const values = Array.isArray(answerValue) ? answerValue : [];
  const validOptionIds = (question.options || []).map((item) => item.optionId);
  const invalidSelected = values.some((item) => !validOptionIds.includes(item));
  if (invalidSelected) {
    return '多选题答案不合法';
  }

  const selectedCount = values.length;
  const multiValidation = question.validation?.multi || {};

  if (multiValidation.exactSelected !== undefined && selectedCount !== multiValidation.exactSelected) {
    return `该题必须选择 ${multiValidation.exactSelected} 个选项`;
  }
  if (multiValidation.minSelected !== undefined && selectedCount < multiValidation.minSelected) {
    return `该题至少选择 ${multiValidation.minSelected} 个选项`;
  }
  if (question.required && selectedCount === 0) {
    return '请至少选择 1 个选项';
  }
  if (multiValidation.maxSelected !== undefined && selectedCount > multiValidation.maxSelected) {
    return `该题最多选择 ${multiValidation.maxSelected} 个选项`;
  }

  return null;
}

function validateText(question, answerValue) {
  if (question.required && isEmpty(answerValue)) {
    return '该填空题为必答题';
  }
  if (!isEmpty(answerValue)) {
    const text = String(answerValue);
    const validation = question.validation?.text || {};
    if (validation.minLength !== undefined && text.length < validation.minLength) {
      return `文本长度不能少于 ${validation.minLength}`;
    }
    if (validation.maxLength !== undefined && text.length > validation.maxLength) {
      return `文本长度不能超过 ${validation.maxLength}`;
    }
  }
  return null;
}

function validateNumber(question, answerValue) {
  if (question.required && isEmpty(answerValue)) {
    return '该数字题为必答题';
  }
  if (!isEmpty(answerValue)) {
    const value = Number(answerValue);
    const validation = question.validation?.number || {};
    if (Number.isNaN(value)) {
      return '请输入合法数字';
    }
    if (validation.integerOnly && !Number.isInteger(value)) {
      return '该题必须输入整数';
    }
    if (validation.min !== undefined && value < validation.min) {
      return `该题最小值为 ${validation.min}`;
    }
    if (validation.max !== undefined && value > validation.max) {
      return `该题最大值为 ${validation.max}`;
    }
  }
  return null;
}

function validateQuestionAnswer(question, answerValue) {
  switch (question.type) {
    case 'single_choice':
      return validateSingleChoice(question, answerValue);
    case 'multi_choice':
      return validateMultiChoice(question, answerValue);
    case 'text':
      return validateText(question, answerValue);
    case 'number':
      return validateNumber(question, answerValue);
    default:
      return '未知题型';
  }
}

module.exports = {
  validateQuestionAnswer
};
