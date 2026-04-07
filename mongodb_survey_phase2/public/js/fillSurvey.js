const survey = window.__SURVEY__;
const surveyQuestionHost = document.getElementById('surveyQuestionHost');
const answersPayloadInput = document.getElementById('answersPayload');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const clientError = document.getElementById('clientError');
const form = document.getElementById('fillSurveyForm');

const answersMap = {};
const visitedStack = [];
let currentQuestionId = survey.questionOrder[0] || null;
let isShowingSummary = false;

function getQuestionById(questionId) {
  return survey.questions.find((item) => item.questionId === questionId);
}

function getSequentialNextQuestionId(questionId) {
  const index = survey.questionOrder.indexOf(questionId);
  return survey.questionOrder[index + 1] || null;
}

function getOptionLabel(question, optionId) {
  const option = (question.options || []).find((item) => item.optionId === optionId);
  return option ? option.label : '';
}

function getMultiLabels(question, answerValue) {
  if (!Array.isArray(answerValue)) return [];
  return answerValue.map((optionId) => getOptionLabel(question, optionId));
}

function ruleMatched(question, rule, answerValue) {
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

function getJumpNextQuestionId(question, answerValue) {
  const rules = [...(question.jumpRules || [])].sort((a, b) => a.priority - b.priority);
  for (const rule of rules) {
    if (ruleMatched(question, rule, answerValue)) {
      return rule.targetQuestionId === '__SUBMIT__' ? null : rule.targetQuestionId;
    }
  }
  return getSequentialNextQuestionId(question.questionId);
}

function showError(message) {
  clientError.textContent = message;
  clientError.classList.remove('hidden');
}

function hideError() {
  clientError.textContent = '';
  clientError.classList.add('hidden');
}

function renderSingleChoice(question) {
  return `
    <div class="choice-list">
      ${(question.options || [])
        .map((option) => `
          <label class="choice-item">
            <input type="radio" name="single_choice" value="${option.optionId}" ${answersMap[question.questionId] === option.optionId ? 'checked' : ''} />
            <span>${option.label}</span>
          </label>
        `)
        .join('')}
    </div>
  `;
}

function getMultiChoiceHint(question) {
  const v = question.validation?.multi || {};
  const hints = [];

  if (v.exactSelected !== undefined && v.exactSelected !== null && v.exactSelected !== '') {
    hints.push(`请选择 ${v.exactSelected} 项`);
  } else {
    if (v.minSelected !== undefined && v.minSelected !== null && v.minSelected !== '') {
      hints.push(`至少选择 ${v.minSelected} 项`);
    } else if (question.required) {
      hints.push('至少选择 1 项');
    }

    if (v.maxSelected !== undefined && v.maxSelected !== null && v.maxSelected !== '') {
      hints.push(`最多选择 ${v.maxSelected} 项`);
    }
  }

  return hints.join('，');
}

function renderMultiChoice(question) {
  const selected = answersMap[question.questionId] || [];
  const hint = getMultiChoiceHint(question);

  return `
    <div class="choice-list">
      ${(question.options || [])
        .map((option) => `
          <label class="choice-item">
            <input type="checkbox" name="multi_choice" value="${option.optionId}" ${selected.includes(option.optionId) ? 'checked' : ''} />
            <span>${option.label}</span>
          </label>
        `)
        .join('')}
    </div>
    ${hint ? `<div class="muted">${hint}</div>` : ''}
  `;
}

function renderText(question) {
  return `
    <label>请输入内容
      <textarea id="textAnswer" rows="4">${answersMap[question.questionId] || ''}</textarea>
    </label>
  `;
}

function renderNumber(question) {
  return `
    <label>请输入数字
      <input id="numberAnswer" type="number" value="${answersMap[question.questionId] ?? ''}" />
    </label>
  `;
}

function renderQuestion() {
  hideError();
  isShowingSummary = false;
  const question = getQuestionById(currentQuestionId);
  if (!question) return;

  let inputHtml = '';
  switch (question.type) {
    case 'single_choice':
      inputHtml = renderSingleChoice(question);
      break;
    case 'multi_choice':
      inputHtml = renderMultiChoice(question);
      break;
    case 'text':
      inputHtml = renderText(question);
      break;
    case 'number':
      inputHtml = renderNumber(question);
      break;
    default:
      inputHtml = '<p>未知题型</p>';
  }

  surveyQuestionHost.innerHTML = `
    <div class="question-host">
      <div class="muted">当前题号：${survey.questionOrder.indexOf(question.questionId) + 1} / ${survey.questionOrder.length}</div>
      <div class="question-title">${question.title} ${question.required ? '<span style="color:#dc2626">*</span>' : ''}</div>
      <div class="muted">${question.description || ''}</div>
      ${inputHtml}
    </div>
  `;

  prevBtn.disabled = visitedStack.length === 0;
  nextBtn.classList.remove('hidden');
  submitBtn.classList.add('hidden');
}

function collectCurrentAnswer() {
  const question = getQuestionById(currentQuestionId);

  if (question.type === 'single_choice') {
    const selected = document.querySelector('input[name="single_choice"]:checked');
    return selected ? selected.value : '';
  }

  if (question.type === 'multi_choice') {
    return [...document.querySelectorAll('input[name="multi_choice"]:checked')].map((item) => item.value);
  }

  if (question.type === 'text') {
    return document.getElementById('textAnswer')?.value || '';
  }

  if (question.type === 'number') {
    return document.getElementById('numberAnswer')?.value || '';
  }

  return '';
}

function clientValidate(question, value) {
  if (question.type === 'multi_choice' && Array.isArray(value)) {
    const v = question.validation?.multi || {};
    if (v.exactSelected !== undefined && v.exactSelected !== null && v.exactSelected !== '' && value.length !== Number(v.exactSelected)) {
      return `该题必须选择 ${v.exactSelected} 个选项`;
    }
    if (v.minSelected !== undefined && v.minSelected !== null && v.minSelected !== '' && value.length < Number(v.minSelected)) {
      return `该题至少选择 ${v.minSelected} 个选项`;
    }
    if (question.required && value.length === 0) {
      return '请至少选择 1 个选项';
    }
    if (v.maxSelected !== undefined && v.maxSelected !== null && v.maxSelected !== '' && value.length > Number(v.maxSelected)) {
      return `该题最多选择 ${v.maxSelected} 个选项`;
    }
  }

  if (question.required) {
    const empty = value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
    if (empty) return '该题为必答题';
  }

  if (question.type === 'text' && value !== '') {
    const v = question.validation?.text || {};
    if (v.minLength !== undefined && v.minLength !== null && v.minLength !== '' && String(value).length < Number(v.minLength)) {
      return `文本长度不能少于 ${v.minLength}`;
    }
    if (v.maxLength !== undefined && v.maxLength !== null && v.maxLength !== '' && String(value).length > Number(v.maxLength)) {
      return `文本长度不能超过 ${v.maxLength}`;
    }
  }

  if (question.type === 'number' && value !== '') {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return '请输入合法数字';
    const v = question.validation?.number || {};
    if (v.integerOnly && !Number.isInteger(numericValue)) return '该题必须为整数';
    if (v.min !== undefined && v.min !== null && v.min !== '' && numericValue < Number(v.min)) {
      return `最小值为 ${v.min}`;
    }
    if (v.max !== undefined && v.max !== null && v.max !== '' && numericValue > Number(v.max)) {
      return `最大值为 ${v.max}`;
    }
  }

  return '';
}

function goNext() {
  const question = getQuestionById(currentQuestionId);
  const answerValue = collectCurrentAnswer();
  const validationError = clientValidate(question, answerValue);

  if (validationError) {
    showError(validationError);
    return;
  }

  answersMap[currentQuestionId] = answerValue;

  const nextQuestionId = getJumpNextQuestionId(question, answerValue);

  if (!nextQuestionId) {
    nextBtn.classList.add('hidden');
    submitBtn.classList.remove('hidden');
    showSummaryCard();
    return;
  }

  visitedStack.push(currentQuestionId);
  currentQuestionId = nextQuestionId;
  renderQuestion();
}

function showSummaryCard() {
  const currentQuestion = getQuestionById(currentQuestionId);
  if (currentQuestion) {
    answersMap[currentQuestionId] = collectCurrentAnswer();
  }

  isShowingSummary = true;

  surveyQuestionHost.innerHTML = `
    <div class="question-host">
      <div class="question-title">已完成所有题目</div>
      <div class="muted">点击“提交问卷”即可提交；点击“上一题”可修改答案。</div>
      <pre>${JSON.stringify(answersMap, null, 2)}</pre>
    </div>
  `;
  prevBtn.disabled = false;
}

function goPrev() {
  hideError();
  if (visitedStack.length === 0) return;
  currentQuestionId = visitedStack.pop();
  renderQuestion();
}

prevBtn.addEventListener('click', goPrev);
nextBtn.addEventListener('click', goNext);

form.addEventListener('submit', () => {
  const currentQuestion = getQuestionById(currentQuestionId);

  if (!isShowingSummary && currentQuestion) {
    answersMap[currentQuestionId] = collectCurrentAnswer();
  }

  answersPayloadInput.value = JSON.stringify(answersMap);
});

renderQuestion();
