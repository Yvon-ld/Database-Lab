const form = document.getElementById('questionEditorForm');
const payloadInput = document.getElementById('questionPayload');
const questionType = document.getElementById('questionType');
const optionsContainer = document.getElementById('questionOptions');
const addOptionBtn = document.getElementById('addOptionBtn');
const initialQuestion = window.__INITIAL_QUESTION__ || null;

function randomId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createOptionRow(option = {}) {
  const row = document.createElement('div');
  row.className = 'option-block';
  row.dataset.optionId = option.optionId || randomId('option');
  row.innerHTML = `
    <label>Option label
      <input class="option-label" type="text" value="${option.label || ''}" />
    </label>
    <button class="btn btn-danger remove-option-btn" type="button">Remove</button>
  `;

  row.querySelector('.remove-option-btn').addEventListener('click', () => row.remove());
  return row;
}

function toggleSections() {
  const type = questionType.value;
  document.getElementById('choiceSettings').style.display =
    (type === 'single_choice' || type === 'multi_choice') ? 'block' : 'none';
  document.getElementById('textSettings').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('numberSettings').style.display = type === 'number' ? 'block' : 'none';
  document.getElementById('multiSettings').style.display = type === 'multi_choice' ? 'block' : 'none';
}

function loadInitialQuestion() {
  const options = initialQuestion?.options?.length ? initialQuestion.options : [{}, {}];
  options.forEach((option) => optionsContainer.appendChild(createOptionRow(option)));
  toggleSections();
}

addOptionBtn.addEventListener('click', () => {
  optionsContainer.appendChild(createOptionRow());
});

questionType.addEventListener('change', toggleSections);

form.addEventListener('submit', () => {
  const payload = {
    title: document.getElementById('questionTitle').value,
    description: document.getElementById('questionDescription').value,
    type: questionType.value,
    required: document.getElementById('questionRequired').checked,
    options: [...optionsContainer.querySelectorAll('.option-block')].map((row) => ({
      optionId: row.dataset.optionId,
      label: row.querySelector('.option-label').value
    })),
    validation: {
      text: {
        minLength: document.getElementById('textMinLength').value,
        maxLength: document.getElementById('textMaxLength').value
      },
      number: {
        min: document.getElementById('numberMin').value,
        max: document.getElementById('numberMax').value,
        integerOnly: document.getElementById('integerOnly').checked
      },
      multi: {
        minSelected: document.getElementById('multiMin').value,
        maxSelected: document.getElementById('multiMax').value,
        exactSelected: document.getElementById('multiExact').value
      }
    }
  };

  payloadInput.value = JSON.stringify(payload);
});

loadInitialQuestion();
