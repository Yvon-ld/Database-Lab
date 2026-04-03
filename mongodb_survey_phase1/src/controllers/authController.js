const User = require('../models/User');

async function showRegisterPage(req, res) {
  res.render('auth/register');
}

async function register(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      req.session.error = '用户名和密码不能为空';
      return res.redirect('/auth/register');
    }

    if (password.length < 6) {
      req.session.error = '密码长度至少 6 位';
      return res.redirect('/auth/register');
    }

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      req.session.error = '用户名已存在';
      return res.redirect('/auth/register');
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      username: username.trim(),
      passwordHash
    });

    req.session.userId = user._id.toString();
    req.session.success = '注册成功，已自动登录';
    return res.redirect('/dashboard');
  } catch (error) {
    req.session.error = `注册失败：${error.message}`;
    return res.redirect('/auth/register');
  }
}

async function showLoginPage(req, res) {
  res.render('auth/login');
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.trim() });

    if (!user) {
      req.session.error = '用户名或密码错误';
      return res.redirect('/auth/login');
    }

    const matched = await user.comparePassword(password);
    if (!matched) {
      req.session.error = '用户名或密码错误';
      return res.redirect('/auth/login');
    }

    req.session.userId = user._id.toString();
    req.session.success = '登录成功';
    return res.redirect('/dashboard');
  } catch (error) {
    req.session.error = `登录失败：${error.message}`;
    return res.redirect('/auth/login');
  }
}

async function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
}

module.exports = {
  showRegisterPage,
  register,
  showLoginPage,
  login,
  logout
};
