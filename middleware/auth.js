// middleware/auth.js
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Silakan login terlebih dahulu.');
  return res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error', 'Akses ditolak. Hanya Admin.');
  return res.redirect('/dashboard');
}

function isAdminOrTatib(req, res, next) {
  const role = req.session.user && req.session.user.role;
  if (role === 'admin' || role === 'tatib') return next();
  req.flash('error', 'Akses ditolak.');
  return res.redirect('/dashboard');
}

module.exports = { isAuthenticated, isAdmin, isAdminOrTatib };
