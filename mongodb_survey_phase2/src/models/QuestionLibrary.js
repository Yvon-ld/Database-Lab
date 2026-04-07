const mongoose = require('mongoose');

const questionLibrarySchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    questionRootIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
      }
    ]
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

module.exports = mongoose.model('QuestionLibrary', questionLibrarySchema);
