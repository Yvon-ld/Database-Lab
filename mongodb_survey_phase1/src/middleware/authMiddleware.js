function requireAuth(req, res, next) {
  if (!req.currentUser) {
    req.session.error = '请先登录';
    return res.redirect('/auth/login');
  }
  next();
}

function redirectIfLoggedIn(req, res, next) {
  if (req.currentUser) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfLoggedIn
};
