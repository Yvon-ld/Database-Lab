const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    optionId: { type: String, required: true },
    label: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    rootQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null,
      index: true
    },
    parentQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null
    },
    version: { type: Number, default: 1 },
    visibility: {
      type: String,
      enum: ['private', 'shared'],
      default: 'private',
      index: true
    },
    sharedWithUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    type: {
      type: String,
      enum: ['single_choice', 'multi_choice', 'text', 'number'],
      required: true
    },
    required: { type: Boolean, default: false },
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
    }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

questionSchema.pre('save', function setRootQuestionId(next) {
  if (!this.rootQuestionId) {
    this.rootQuestionId = this._id;
  }
  next();
});

questionSchema.index({ rootQuestionId: 1, version: 1 }, { unique: true });
questionSchema.index({ sharedWithUserIds: 1 });

module.exports = mongoose.model('Question', questionSchema);
