const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    sourceQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null
    },
    sourceQuestionRootId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null
    },
    sourceQuestionVersion: {
      type: Number,
      default: null
    },
    questionTitleSnapshot: { type: String, required: true },
    questionType: {
      type: String,
      enum: ['single_choice', 'multi_choice', 'text', 'number'],
      required: true
    },
    value: mongoose.Schema.Types.Mixed
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Survey',
      required: true,
      index: true
    },
    surveyTitleSnapshot: { type: String, required: true },
    surveyVersion: { type: Number, default: 1 },
    respondentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    respondentType: {
      type: String,
      enum: ['user', 'anonymous'],
      required: true
    },
    visitedQuestionIds: { type: [String], default: [] },
    answers: { type: [answerSchema], default: [] },
    submittedAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

responseSchema.index({ surveyId: 1, respondentId: 1, submittedAt: -1 });

module.exports = mongoose.model('Response', responseSchema);
