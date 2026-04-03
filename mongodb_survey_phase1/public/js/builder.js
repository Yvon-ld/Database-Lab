const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const builderForm = document.getElementById('builderForm');
const builderPayloadInput = document.getElementById('builderPayload');

function randomId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createOptionRow(option = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'option-block';
  wrapper.dataset.optionId = option.optionId || randomId('option');

  wrapper.innerHTML = `
    <label>选项文本
      <input class="option-label" type="text" value="${option.label || ''}" />
    </label>
    <button class="btn btn-danger remove-option-btn" type="button">删除选项</button>
  `;

  wrapper.querySelector('.remove-option-btn').addEventListener('click', () => wrapper.remove());
  return wrapper;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildTargetOptions(currentQuestionId, selectedValue = '') {
  const options = [
    `<option value="">请选择跳转目标</option>`,
    `<option value="__SUBMIT__" ${selectedValue === '__SUBMIT__' ? 'selected' : ''}>直接提交问卷</option>`
  ];

  [...questionsContainer.querySelectorAll('.question-block')].forEach((block, index) => {
    if (block.dataset.questionId === currentQuestionId) return;

    const qid = block.dataset.questionId;
    const title =
      block.querySelector('.question-title-input')?.value.trim() || `题目 ${index + 1}`;

    options.push(
      `<option value="${escapeHtml(qid)}" ${selectedValue === qid ? 'selected' : ''}>
        跳到题目 ${index + 1}：${escapeHtml(title)}
      </option>`
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

  [singleField, listField, minField, maxField].forEach((el) => {
    el.style.display = 'none';
  });

  if (type === 'single_equals') {
    singleField.style.display = 'grid';
    singleLabel.textContent = '当答案等于这个选项';
    helpText.textContent = '适合单选题，例如：选择“男”时跳到指定题目。';
  } else if (type === 'multi_contains_any') {
    listField.style.display = 'grid';
    helpText.textContent = '适合多选题，只要包含下面任意一个选项就跳转。';
  } else if (type === 'multi_contains_all') {
    listField.style.display = 'grid';
    helpText.textContent = '适合多选题，必须同时包含下面所有选项才跳转。';
  } else if (['number_gt', 'number_gte', 'number_lt', 'number_lte'].includes(type)) {
    singleField.style.display = 'grid';
    singleLabel.textContent = '比较数值';
    helpText.textContent = '适合数字题，例如：大于等于 10 时跳转。';
  } else if (type === 'number_between') {
    minField.style.display = 'grid';
    maxField.style.display = 'grid';
    helpText.textContent = '适合数字题，当答案处于某个区间时跳转。';
  } else {
    helpText.textContent = '默认跳转：当前面规则都不满足时，按照这里设置的目标跳转。';
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
      <strong>跳题条件</strong>
      <button class="btn btn-danger remove-rule-btn" type="button">删除规则</button>
    </div>

    <label>
      <span>判断顺序</span>
      <input class="rule-priority" type="number" min="1" value="${rule.priority || 1}" />
      <small class="rule-tip">数字越小，越先判断；当前规则命中后，后面的规则不再执行。</small>
    </label>

    <label>当用户的回答
      <select class="rule-type">
        <option value="single_equals">等于某个单选项</option>
        <option value="multi_contains_any">包含任意一个选项</option>
        <option value="multi_contains_all">同时包含多个选项</option>
        <option value="number_gt">大于某个数</option>
        <option value="number_gte">大于等于某个数</option>
        <option value="number_lt">小于某个数</option>
        <option value="number_lte">小于等于某个数</option>
        <option value="number_between">位于某个区间</option>
        <option value="always">其他情况默认跳转</option>
      </select>
    </label>

    <label class="rule-field-single">
      <span class="rule-single-label">匹配值</span>
      <input class="rule-value" type="text" value="${rule.value ?? ''}" />
    </label>

    <label class="rule-field-list">
      <span>选项列表（多个值用英文逗号分隔）</span>
      <input class="rule-values" type="text" value="${Array.isArray(rule.values) ? rule.values.join(',') : ''}" placeholder="例如：苹果,香蕉" />
    </label>

    <label class="rule-field-min">
      <span>最小值</span>
      <input class="rule-min" type="number" value="${rule.min ?? ''}" />
    </label>

    <label class="rule-field-max">
      <span>最大值</span>
      <input class="rule-max" type="number" value="${rule.max ?? ''}" />
    </label>

    <label>就跳转到
      <select class="rule-target">
        ${buildTargetOptions(currentQuestionId, rule.targetQuestionId || '')}
      </select>
    </label>

    <p class="rule-help muted"></p>
  `;

  const targetSelect = wrapper.querySelector('.rule-target');
  if (targetSelect) {
    targetSelect.dataset.savedValue = rule.targetQuestionId || '';
    targetSelect.addEventListener('change', () => {
      targetSelect.dataset.savedValue = targetSelect.value;
    });
  }

  wrapper.querySelector('.rule-type').value = rule.ruleType || 'single_equals';

  wrapper.querySelector('.rule-type').addEventListener('change', () => {
    updateRuleUI(wrapper);
  });

  wrapper.querySelector('.remove-rule-btn').addEventListener('click', () => {
    wrapper.remove();
  });

  updateRuleUI(wrapper);
  return wrapper;
}

function createQuestionBlock(question = {}) {
  const questionId = question.questionId || randomId('question');
  const wrapper = document.createElement('div');
  wrapper.className = 'question-block';
  wrapper.dataset.questionId = questionId;

  wrapper.innerHTML = `
    <div class="page-head">
      <div>
        <h3>题目 <span class="question-index"></span></h3>
        <p class="muted">题目编号：<code class="question-id-label">${questionId}</code></p>
      </div>
      <button class="btn btn-danger remove-question-btn" type="button">删除本题</button>
    </div>

    <label>题目标题
      <input class="question-title-input" type="text" value="${question.title || ''}" />
    </label>

    <label>补充说明（可选）
      <textarea class="question-description-input" rows="2">${question.description || ''}</textarea>
    </label>

    <label>题型
      <select class="question-type-select">
        <option value="single_choice">单选题</option>
        <option value="multi_choice">多选题</option>
        <option value="text">文本填空题</option>
        <option value="number">数字填空题</option>
      </select>
    </label>

    <label>
      <input class="question-required-input" type="checkbox" ${question.required ? 'checked' : ''} />
      设为必答题
    </label>

    <section class="choice-settings">
      <div class="page-head">
        <div>
          <h4>选项</h4>
          <p class="muted">建议至少添加两个选项</p>
        </div>
        <button class="btn btn-secondary add-option-btn" type="button">+ 添加选项</button>
      </div>
      <div class="option-list"></div>
    </section>

    <section class="text-settings">
      <h4>文本校验</h4>
      <label>最少长度
        <input class="text-min-length" type="number" value="${question.validation?.text?.minLength ?? ''}" />
      </label>
      <label>最大长度
        <input class="text-max-length" type="number" value="${question.validation?.text?.maxLength ?? ''}" />
      </label>
    </section>

    <section class="number-settings">
      <h4>数字校验</h4>
      <label>最小值
        <input class="number-min" type="number" value="${question.validation?.number?.min ?? ''}" />
      </label>
      <label>最大值
        <input class="number-max" type="number" value="${question.validation?.number?.max ?? ''}" />
      </label>
      <label>
        <input class="number-integer-only" type="checkbox" ${question.validation?.number?.integerOnly ? 'checked' : ''} />
        必须为整数
      </label>
    </section>

    <section class="multi-settings">
      <h4>多选校验</h4>
      <label>至少选择几个
        <input class="multi-min" type="number" value="${question.validation?.multi?.minSelected ?? ''}" />
      </label>
      <label>最多选择几个
        <input class="multi-max" type="number" value="${question.validation?.multi?.maxSelected ?? ''}" />
      </label>
      <label>必须恰好选择几个
        <input class="multi-exact" type="number" value="${question.validation?.multi?.exactSelected ?? ''}" />
      </label>
    </section>

    <section class="jump-settings">
      <div class="page-head">
        <div>
          <h4>按回答自动跳题（可选）</h4>
          <p class="muted">只有需要“根据答案跳到别的题目”时才设置；普通题目可以留空。</p>
        </div>
        <button class="btn btn-secondary add-rule-btn" type="button">+ 添加跳题规则</button>
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
    optionList.appendChild(createOptionRow(option));
  });

  (question.jumpRules || []).forEach((rule) => {
    ruleList.appendChild(createRuleRow(rule, questionId));
  });

  wrapper.querySelector('.add-option-btn').addEventListener('click', () => {
    optionList.appendChild(createOptionRow());
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

addQuestionBtn.addEventListener('click', () => {
  const newBlock = createQuestionBlock({ type: 'single_choice' });
  questionsContainer.appendChild(newBlock);
  refreshQuestionIndexes();
  refreshAllRuleTargets();

  requestAnimationFrame(() => {
    newBlock.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    const titleInput = newBlock.querySelector('.question-title-input');
    if (titleInput) {
      titleInput.focus();
    }
  });
});

builderForm.addEventListener('submit', () => {
  const payload = {
    title: document.getElementById('surveyTitle').value,
    description: document.getElementById('surveyDescription').value,
    settings: {
      allowAnonymous: document.getElementById('allowAnonymous').checked,
      allowMultipleSubmissions: document.getElementById('allowMultipleSubmissions').checked,
      deadlineAt: document.getElementById('deadlineAt').value
    },
    questions: [...questionsContainer.children].map(serializeQuestionBlock)
  };

  builderPayloadInput.value = JSON.stringify(payload);
});

loadInitialSurvey();
