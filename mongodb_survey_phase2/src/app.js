require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const pageRoutes = require('./routes/pageRoutes');
const questionRoutes = require('./routes/questionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mongodb_survey_system',
      collectionName: 'sessions'
    }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.error = req.session.error || null;
  res.locals.success = req.session.success || null;
  delete req.session.error;
  delete req.session.success;

  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();
      if (user) {
        req.currentUser = user;
        res.locals.currentUser = user;
      }
    } catch (error) {
      console.error('Load current user failed:', error.message);
    }
  }
  next();
});

app.use('/', pageRoutes);
app.use('/auth', authRoutes);
app.use('/surveys', surveyRoutes);
app.use('/questions', questionRoutes);

app.use((req, res) => {
  res.status(404).render('partials/message', {
    title: '404 Not Found',
    message: '页面不存在'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
