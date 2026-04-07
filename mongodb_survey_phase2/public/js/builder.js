const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const builderForm = document.getElementById('builderForm');
const builderPayloadInput = document.getElementById('builderPayload');
const saveSurveyBtn = document.getElementById('saveSurveyBtn');
const surveyLocked = !!window.__SURVEY_LOCKED__;
const questionCatalog = window.__QUESTION_CATALOG__ || { questions: [], libraries: [] };
const questionCatalogMap = new Map(((questionCatalog.questionVersions || questionCatalog.questions) || []).map((question) => [String(question._id), question]));

function randomId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createOptionRow(option = {}, disabled = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'option-block';
  wrapper.dataset.optionId = option.optionId || randomId('option');

  wrapper.innerHTML = `
    <label>Option label
      <input class="option-label" type="text" value="${escapeHtml(option.label || '')}" ${disabled ? 'disabled' : ''} />
    </label>
    <button class="btn btn-danger remove-option-btn" type="button" ${disabled ? 'disabled' : ''}>Remove</button>
  `;

  wrapper.querySelector('.remove-option-btn').addEventListener('click', () => wrapper.remove());
  return wrapper;
}

function buildTargetOptions(currentQuestionId, selectedValue = '') {
  const options = [
    `<option value="">Select target</option>`,
    `<option value="__SUBMIT__" ${selectedValue === '__SUBMIT__' ? 'selected' : ''}>Submit survey</option>`
  ];

  [...questionsContainer.querySelectorAll('.question-block')].forEach((block, index) => {
    if (block.dataset.questionId === currentQuestionId) return;

    const qid = block.dataset.questionId;
    const title =
      block.querySelector('.question-title-input')?.value.trim() || `Question ${index + 1}`;

    options.push(
      `<option value="${escapeHtml(qid)}" ${selectedValue === qid ? 'selected' : ''}>Jump to Q${index + 1}: ${escapeHtml(title)}</option>`
    );
  });

  return options.join('');
}

function updateRuleUI(ruleBlock) {
  const type = ruleBlock.querySelector('.rule-type').value;
  const singleField = ruleBlock.querySelector('.rule-field-single');
  const listField = ruleBlock.querySelector('.rule-field-list');
  const minField = ruleBlock.querySelector('.rule-field-min');
  const maxField = ruleBlock.querySelector('.rule-field-max');
  const singleLabel = ruleBlock.querySelector('.rule-single-label');
  const helpText = ruleBlock.querySelector('.rule-help');

  [singleField, listField, minField, maxField].forEach((element) => {
    element.style.display = 'none';
  });

  if (type === 'single_equals') {
    singleField.style.display = 'grid';
    singleLabel.textContent = 'Expected option id';
    helpText.textContent = 'Use the option id of the selected choice.';
  } else if (type === 'multi_contains_any') {
    listField.style.display = 'grid';
    helpText.textContent = 'Jump when the multi-select answer contains any listed option id.';
  } else if (type === 'multi_contains_all') {
    listField.style.display = 'grid';
    helpText.textContent = 'Jump when the multi-select answer contains all listed option ids.';
  } else if (['number_gt', 'number_gte', 'number_lt', 'number_lte'].includes(type)) {
    singleField.style.display = 'grid';
    singleLabel.textContent = 'Compare against value';
    helpText.textContent = 'Use numeric thresholds for number questions.';
  } else if (type === 'number_between') {
    minField.style.display = 'grid';
    maxField.style.display = 'grid';
    helpText.textContent = 'Jump when the numeric answer stays within the specified range.';
  } else {
    helpText.textContent = 'Default rule used when no earlier rule matches.';
  }
}

function refreshAllRuleTargets() {
  [...questionsContainer.querySelectorAll('.question-block')].forEach((block) => {
    const currentQuestionId = block.dataset.questionId;
    block.querySelectorAll('.rule-target').forEach((select) => {
      const selected = select.dataset.savedValue || select.value || '';
      select.innerHTML = buildTargetOptions(currentQuestionId, selected);

      if ([...select.options].some((option) => option.value === selected)) {
        select.value = selected;
      } else {
        select.value = '';
      }
    });
  });
}

function createRuleRow(rule = {}, currentQuestionId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'rule-block';

  wrapper.innerHTML = `
    <div class="rule-row-head">
      <strong>Jump rule</strong>
      <button class="btn btn-danger remove-rule-btn" type="button" ${surveyLocked ? 'disabled' : ''}>Remove</button>
    </div>

    <label>Priority
      <input class="rule-priority" type="number" min="1" value="${rule.priority || 1}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label>When answer
      <select class="rule-type" ${surveyLocked ? 'disabled' : ''}>
        <option value="single_equals">single equals</option>
        <option value="multi_contains_any">multi contains any</option>
        <option value="multi_contains_all">multi contains all</option>
        <option value="number_gt">number &gt;</option>
        <option value="number_gte">number &gt;=</option>
        <option value="number_lt">number &lt;</option>
        <option value="number_lte">number &lt;=</option>
        <option value="number_between">number between</option>
        <option value="always">always</option>
      </select>
    </label>

    <label class="rule-field-single">
      <span class="rule-single-label">Value</span>
      <input class="rule-value" type="text" value="${escapeHtml(rule.value ?? '')}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label class="rule-field-list">
      <span>Comma-separated values</span>
      <input class="rule-values" type="text" value="${escapeHtml(Array.isArray(rule.values) ? rule.values.join(',') : '')}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label class="rule-field-min">
      <span>Min</span>
      <input class="rule-min" type="number" value="${rule.min ?? ''}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label class="rule-field-max">
      <span>Max</span>
      <input class="rule-max" type="number" value="${rule.max ?? ''}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label>Target
      <select class="rule-target" ${surveyLocked ? 'disabled' : ''}>
        ${buildTargetOptions(currentQuestionId, rule.targetQuestionId || '')}
      </select>
    </label>

    <p class="rule-help muted"></p>
  `;

  const targetSelect = wrapper.querySelector('.rule-target');
  targetSelect.dataset.savedValue = rule.targetQuestionId || '';
  targetSelect.addEventListener('change', () => {
    targetSelect.dataset.savedValue = targetSelect.value;
  });

  wrapper.querySelector('.rule-type').value = rule.ruleType || 'single_equals';
  wrapper.querySelector('.rule-type').addEventListener('change', () => updateRuleUI(wrapper));
  wrapper.querySelector('.remove-rule-btn').addEventListener('click', () => wrapper.remove());

  updateRuleUI(wrapper);
  return wrapper;
}

function createQuestionBlock(question = {}) {
  const questionId = question.questionId || randomId('question');
  const sourceLocked = !!question.sourceLocked;
  const sourceMeta = sourceLocked
    ? `<div class="question-source-note">Imported from question bank root ${escapeHtml(String(question.sourceQuestionRootId || ''))}, version ${escapeHtml(String(question.sourceQuestionVersion || ''))}. Definition fields are locked.</div>`
    : '';

  const wrapper = document.createElement('div');
  wrapper.className = 'question-block';
  wrapper.dataset.questionId = questionId;
  wrapper.dataset.sourceQuestionId = question.sourceQuestionId || '';
  wrapper.dataset.sourceQuestionRootId = question.sourceQuestionRootId || '';
  wrapper.dataset.sourceQuestionVersion = question.sourceQuestionVersion || '';
  wrapper.dataset.sourceLocked = sourceLocked ? 'true' : 'false';

  wrapper.innerHTML = `
    <div class="page-head">
      <div>
        <h3>Question <span class="question-index"></span></h3>
        <p class="muted">Runtime id: <code class="question-id-label">${questionId}</code></p>
      </div>
      <button class="btn btn-danger remove-question-btn" type="button" ${surveyLocked ? 'disabled' : ''}>Remove</button>
    </div>

    ${sourceMeta}

    <label>Question title
      <input class="question-title-input" type="text" value="${escapeHtml(question.title || '')}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
    </label>

    <label>Description
      <textarea class="question-description-input" rows="2" ${(sourceLocked || surveyLocked) ? 'disabled' : ''}>${escapeHtml(question.description || '')}</textarea>
    </label>

    <label>Type
      <select class="question-type-select" ${(sourceLocked || surveyLocked) ? 'disabled' : ''}>
        <option value="single_choice">single choice</option>
        <option value="multi_choice">multi choice</option>
        <option value="text">text</option>
        <option value="number">number</option>
      </select>
    </label>

    <label>
      <input class="question-required-input" type="checkbox" ${question.required ? 'checked' : ''} ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      Required question
    </label>

    <section class="choice-settings">
      <div class="page-head">
        <div>
          <h4>Options</h4>
          <p class="muted">Choice-based questions need at least two options.</p>
        </div>
        <button class="btn btn-secondary add-option-btn" type="button" ${(sourceLocked || surveyLocked) ? 'disabled' : ''}>+ Add Option</button>
      </div>
      <div class="option-list"></div>
    </section>

    <section class="text-settings">
      <h4>Text Validation</h4>
      <label>Minimum length
        <input class="text-min-length" type="number" value="${question.validation?.text?.minLength ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>Maximum length
        <input class="text-max-length" type="number" value="${question.validation?.text?.maxLength ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
    </section>

    <section class="number-settings">
      <h4>Number Validation</h4>
      <label>Minimum value
        <input class="number-min" type="number" value="${question.validation?.number?.min ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>Maximum value
        <input class="number-max" type="number" value="${question.validation?.number?.max ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>
        <input class="number-integer-only" type="checkbox" ${question.validation?.number?.integerOnly ? 'checked' : ''} ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
        Integer only
      </label>
    </section>

    <section class="multi-settings">
      <h4>Multi-Select Validation</h4>
      <label>Min selected
        <input class="multi-min" type="number" value="${question.validation?.multi?.minSelected ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>Max selected
        <input class="multi-max" type="number" value="${question.validation?.multi?.maxSelected ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>Exact selected
        <input class="multi-exact" type="number" value="${question.validation?.multi?.exactSelected ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
    </section>

    <section class="jump-settings">
      <div class="page-head">
        <div>
          <h4>Survey Jump Rules</h4>
          <p class="muted">These rules belong to this survey only and do not change the reusable question version.</p>
        </div>
        <button class="btn btn-secondary add-rule-btn" type="button" ${surveyLocked ? 'disabled' : ''}>+ Add Jump Rule</button>
      </div>
      <div class="rule-list"></div>
    </section>
  `;

  const typeSelect = wrapper.querySelector('.question-type-select');
  const optionList = wrapper.querySelector('.option-list');
  const ruleList = wrapper.querySelector('.rule-list');
  const titleInput = wrapper.querySelector('.question-title-input');

  typeSelect.value = question.type || 'single_choice';

  function toggleSections() {
    const type = typeSelect.value;
    wrapper.querySelector('.choice-settings').style.display =
      (type === 'single_choice' || type === 'multi_choice') ? 'block' : 'none';
    wrapper.querySelector('.text-settings').style.display = type === 'text' ? 'block' : 'none';
    wrapper.querySelector('.number-settings').style.display = type === 'number' ? 'block' : 'none';
    wrapper.querySelector('.multi-settings').style.display = type === 'multi_choice' ? 'block' : 'none';
  }

  titleInput.addEventListener('input', refreshAllRuleTargets);
  typeSelect.addEventListener('change', toggleSections);
  toggleSections();

  (question.options || [{}, {}]).forEach((option) => {
    optionList.appendChild(createOptionRow(option, sourceLocked || surveyLocked));
  });

  (question.jumpRules || []).forEach((rule) => {
    ruleList.appendChild(createRuleRow(rule, questionId));
  });

  wrapper.querySelector('.add-option-btn').addEventListener('click', () => {
    optionList.appendChild(createOptionRow({}, sourceLocked || surveyLocked));
  });

  wrapper.querySelector('.add-rule-btn').addEventListener('click', () => {
    ruleList.appendChild(createRuleRow({}, questionId));
    refreshAllRuleTargets();
  });

  wrapper.querySelector('.remove-question-btn').addEventListener('click', () => {
    wrapper.remove();
    refreshQuestionIndexes();
    refreshAllRuleTargets();
  });

  return wrapper;
}

function refreshQuestionIndexes() {
  [...questionsContainer.children].forEach((item, index) => {
    const label = item.querySelector('.question-index');
    if (label) label.textContent = index + 1;
  });
}

function serializeQuestionBlock(block) {
  const getValue = (selector) => block.querySelector(selector)?.value ?? '';
  const getChecked = (selector) => !!block.querySelector(selector)?.checked;

  const options = [...block.querySelectorAll('.option-block')].map((item) => ({
    optionId: item.dataset.optionId,
    label: item.querySelector('.option-label').value
  }));

  const jumpRules = [...block.querySelectorAll('.rule-block')].map((item) => ({
    priority: item.querySelector('.rule-priority').value,
    ruleType: item.querySelector('.rule-type').value,
    value: item.querySelector('.rule-value').value,
    values: item.querySelector('.rule-values').value,
    min: item.querySelector('.rule-min').value,
    max: item.querySelector('.rule-max').value,
    targetQuestionId: item.querySelector('.rule-target').value
  }));

  return {
    questionId: block.dataset.questionId,
    sourceQuestionId: block.dataset.sourceQuestionId || null,
    sourceQuestionRootId: block.dataset.sourceQuestionRootId || null,
    sourceQuestionVersion: block.dataset.sourceQuestionVersion || null,
    sourceLocked: block.dataset.sourceLocked === 'true',
    title: getValue('.question-title-input'),
    description: getValue('.question-description-input'),
    type: getValue('.question-type-select'),
    required: getChecked('.question-required-input'),
    options,
    validation: {
      text: {
        minLength: getValue('.text-min-length'),
        maxLength: getValue('.text-max-length')
      },
      number: {
        min: getValue('.number-min'),
        max: getValue('.number-max'),
        integerOnly: getChecked('.number-integer-only')
      },
      multi: {
        minSelected: getValue('.multi-min'),
        maxSelected: getValue('.multi-max'),
        exactSelected: getValue('.multi-exact')
      }
    },
    jumpRules
  };
}

function importCatalogQuestion(questionId) {
  const sourceQuestion = questionCatalogMap.get(String(questionId));
  if (!sourceQuestion) return;

  const newBlock = createQuestionBlock({
    ...sourceQuestion,
    questionId: randomId('question'),
    sourceQuestionId: sourceQuestion._id,
    sourceQuestionRootId: sourceQuestion.rootQuestionId || sourceQuestion._id,
    sourceQuestionVersion: sourceQuestion.version,
    sourceLocked: true,
    jumpRules: []
  });

  questionsContainer.appendChild(newBlock);
  refreshQuestionIndexes();
  refreshAllRuleTargets();
}

function buildSurveyPayload() {
  return {
    title: document.getElementById('surveyTitle').value,
    description: document.getElementById('surveyDescription').value,
    settings: {
      allowAnonymous: document.getElementById('allowAnonymous').checked,
      allowMultipleSubmissions: document.getElementById('allowMultipleSubmissions').checked,
      deadlineAt: document.getElementById('deadlineAt').value
    },
    questions: [...questionsContainer.children].map(serializeQuestionBlock)
  };
}

function syncBuilderPayload() {
  builderPayloadInput.value = JSON.stringify(buildSurveyPayload());
}

function loadInitialSurvey() {
  if (window.__INITIAL_SURVEY__?.questions?.length) {
    window.__INITIAL_SURVEY__.questions.forEach((question) => {
      questionsContainer.appendChild(createQuestionBlock(question));
    });
  } else {
    questionsContainer.appendChild(createQuestionBlock({ type: 'single_choice' }));
  }
  refreshQuestionIndexes();
  refreshAllRuleTargets();
}

if (addQuestionBtn) {
  addQuestionBtn.addEventListener('click', () => {
    const newBlock = createQuestionBlock({ type: 'single_choice' });
    questionsContainer.appendChild(newBlock);
    refreshQuestionIndexes();
    refreshAllRuleTargets();
  });
}

document.querySelectorAll('.import-question-btn').forEach((button) => {
  button.addEventListener('click', () => {
    importCatalogQuestion(button.dataset.questionId);
  });
});

if (saveSurveyBtn) {
  saveSurveyBtn.addEventListener('click', () => {
    if (surveyLocked) return;

    syncBuilderPayload();

    if (typeof builderForm.reportValidity === 'function' && !builderForm.reportValidity()) {
      return;
    }

    if (typeof builderForm.requestSubmit === 'function') {
      builderForm.requestSubmit();
      return;
    }

    builderForm.submit();
  });
}

builderForm.addEventListener('submit', (event) => {
  if (surveyLocked) {
    event.preventDefault();
    return;
  }

  syncBuilderPayload();
});

loadInitialSurvey();
