const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    optionId: { type: String, required: true },
    label: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const jumpRuleSchema = new mongoose.Schema(
  {
    priority: { type: Number, default: 1 },
    ruleType: {
      type: String,
      enum: [
        'single_equals',
        'multi_contains_any',
        'multi_contains_all',
        'number_gt',
        'number_gte',
        'number_lt',
        'number_lte',
        'number_between',
        'always'
      ],
      required: true
    },
    value: mongoose.Schema.Types.Mixed,
    values: [mongoose.Schema.Types.Mixed],
    min: Number,
    max: Number,
    targetQuestionId: { type: String, required: true }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    type: {
      type: String,
      enum: ['single_choice', 'multi_choice', 'text', 'number'],
      required: true
    },
    required: { type: Boolean, default: false },
    order: { type: Number, required: true },
    options: { type: [optionSchema], default: [] },
    validation: {
      text: {
        minLength: Number,
        maxLength: Number
      },
      number: {
        min: Number,
        max: Number,
        integerOnly: { type: Boolean, default: false }
      },
      multi: {
        minSelected: Number,
        maxSelected: Number,
        exactSelected: Number
      }
    },
    jumpRules: { type: [jumpRuleSchema], default: [] }
  },
  { _id: false }
);

const surveySchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
      index: true
    },
    settings: {
      allowAnonymous: { type: Boolean, default: false },
      allowMultipleSubmissions: { type: Boolean, default: true },
      deadlineAt: { type: Date, default: null }
    },
    version: { type: Number, default: 1 },
    questionOrder: { type: [String], default: [] },
    questions: { type: [questionSchema], default: [] },
    publishedAt: Date,
    closedAt: Date
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

module.exports = mongoose.model('Survey', surveySchema);
