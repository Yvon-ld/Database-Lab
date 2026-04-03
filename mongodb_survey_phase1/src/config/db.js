const mongoose = require('mongoose');

async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mongodb_survey_system';
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;
