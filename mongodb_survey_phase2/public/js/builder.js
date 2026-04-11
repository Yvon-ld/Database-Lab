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
    <label>选项内容
      <input class="option-label" type="text" value="${escapeHtml(option.label || '')}" ${disabled ? 'disabled' : ''} />
    </label>
    <button class="btn btn-danger remove-option-btn" type="button" ${disabled ? 'disabled' : ''}>删除</button>
  `;

  wrapper.querySelector('.remove-option-btn').addEventListener('click', () => wrapper.remove());
  return wrapper;
}

function buildTargetOptions(currentQuestionId, selectedValue = '') {
  const options = [
    `<option value="">选择跳转目标</option>`,
    `<option value="__SUBMIT__" ${selectedValue === '__SUBMIT__' ? 'selected' : ''}>提交问卷</option>`
  ];

  [...questionsContainer.querySelectorAll('.question-block')].forEach((block, index) => {
    if (block.dataset.questionId === currentQuestionId) return;

    const qid = block.dataset.questionId;
    const title =
      block.querySelector('.question-title-input')?.value.trim() || `第 ${index + 1} 题`;

    options.push(
      `<option value="${escapeHtml(qid)}" ${selectedValue === qid ? 'selected' : ''}>跳转到第${index + 1}题：${escapeHtml(title)}</option>`
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
    singleLabel.textContent = '期望选项ID';
    helpText.textContent = '请输入所选选项的 optionId。';
  } else if (type === 'multi_contains_any') {
    listField.style.display = 'grid';
    helpText.textContent = '当多选答案包含任意一个列出的 optionId 时跳转。';
  } else if (type === 'multi_contains_all') {
    listField.style.display = 'grid';
    helpText.textContent = '当多选答案包含所有列出的 optionId 时跳转。';
  } else if (['number_gt', 'number_gte', 'number_lt', 'number_lte'].includes(type)) {
    singleField.style.display = 'grid';
    singleLabel.textContent = '比较值';
    helpText.textContent = '数字题可在这里填写比较阈值。';
  } else if (type === 'number_between') {
    minField.style.display = 'grid';
    maxField.style.display = 'grid';
    helpText.textContent = '当数字答案落在指定范围内时跳转。';
  } else {
    helpText.textContent = '当前规则会在前面的规则都不匹配时作为默认规则使用。';
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
      <strong>跳转规则</strong>
      <button class="btn btn-danger remove-rule-btn" type="button" ${surveyLocked ? 'disabled' : ''}>删除</button>
    </div>

    <label>优先级
      <input class="rule-priority" type="number" min="1" value="${rule.priority || 1}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label>触发条件
      <select class="rule-type" ${surveyLocked ? 'disabled' : ''}>
        <option value="single_equals">单选等于</option>
        <option value="multi_contains_any">多选包含任意</option>
        <option value="multi_contains_all">多选包含全部</option>
        <option value="number_gt">数字大于</option>
        <option value="number_gte">数字大于等于</option>
        <option value="number_lt">数字小于</option>
        <option value="number_lte">数字小于等于</option>
        <option value="number_between">数字介于区间内</option>
        <option value="always">始终触发</option>
      </select>
    </label>

    <label class="rule-field-single">
      <span class="rule-single-label">值</span>
      <input class="rule-value" type="text" value="${escapeHtml(rule.value ?? '')}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label class="rule-field-list">
      <span>逗号分隔的多个值</span>
      <input class="rule-values" type="text" value="${escapeHtml(Array.isArray(rule.values) ? rule.values.join(',') : '')}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label class="rule-field-min">
      <span>最小值</span>
      <input class="rule-min" type="number" value="${rule.min ?? ''}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label class="rule-field-max">
      <span>最大值</span>
      <input class="rule-max" type="number" value="${rule.max ?? ''}" ${surveyLocked ? 'disabled' : ''} />
    </label>

    <label>跳转目标
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
    ? `<div class="question-source-note">从题库导入，根题目为 ${escapeHtml(String(question.sourceQuestionRootId || ''))}，版本为 ${escapeHtml(String(question.sourceQuestionVersion || ''))}，当前版本为锁定状态，定义字段不可编辑。</div>`
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
        <h3>题目 <span class="question-index"></span></h3>
        <p class="muted">运行时ID：<code class="question-id-label">${questionId}</code></p>
      </div>
      <button class="btn btn-danger remove-question-btn" type="button" ${surveyLocked ? 'disabled' : ''}>删除</button>
    </div>

    ${sourceMeta}

    <label>题目标题
      <input class="question-title-input" type="text" value="${escapeHtml(question.title || '')}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
    </label>

    <label>题目说明
      <textarea class="question-description-input" rows="2" ${(sourceLocked || surveyLocked) ? 'disabled' : ''}>${escapeHtml(question.description || '')}</textarea>
    </label>

    <label>题目类型
      <select class="question-type-select" ${(sourceLocked || surveyLocked) ? 'disabled' : ''}>
        <option value="single_choice">单选题</option>
        <option value="multi_choice">多选题</option>
        <option value="text">文本题</option>
        <option value="number">数字题</option>
      </select>
    </label>

    <label class="checkbox-inline">
      <input class="question-required-input" type="checkbox" ${question.required ? 'checked' : ''} ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      <span>设为必答题</span>
    </label>

    <section class="choice-settings">
      <div class="page-head">
        <div>
          <h4>选项设置</h4>
          <p class="muted">选择题至少需要两个选项。</p>
        </div>
        <button class="btn btn-secondary add-option-btn" type="button" ${(sourceLocked || surveyLocked) ? 'disabled' : ''}>+ 添加选项</button>
      </div>
      <div class="option-list"></div>
    </section>

    <section class="text-settings">
      <h4>文本校验</h4>
      <label>最小长度
        <input class="text-min-length" type="number" value="${question.validation?.text?.minLength ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>最大长度
        <input class="text-max-length" type="number" value="${question.validation?.text?.maxLength ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
    </section>

    <section class="number-settings">
      <h4>数字校验</h4>
      <label>最小值
        <input class="number-min" type="number" value="${question.validation?.number?.min ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>最大值
        <input class="number-max" type="number" value="${question.validation?.number?.max ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label class="checkbox-inline">
        <input class="question-integer-only-input" type="checkbox" ... />
        <span>仅允许整数</span>
      </label>
    </section>

    <section class="multi-settings">
      <h4>多选校验</h4>
      <label>最少选择数
        <input class="multi-min" type="number" value="${question.validation?.multi?.minSelected ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>最多选择数
        <input class="multi-max" type="number" value="${question.validation?.multi?.maxSelected ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
      <label>必须精确选择数
        <input class="multi-exact" type="number" value="${question.validation?.multi?.exactSelected ?? ''}" ${(sourceLocked || surveyLocked) ? 'disabled' : ''} />
      </label>
    </section>

    <section class="jump-settings">
      <div class="page-head">
        <div>
          <h4>问卷跳转规则</h4>
          <p class="muted">这些规则仅属于当前问卷，不会修改题库中的可复用题目版本。</p>
        </div>
        <button class="btn btn-secondary add-rule-btn" type="button" ${surveyLocked ? 'disabled' : ''}>+ 添加跳转规则</button>
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
