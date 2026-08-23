// Central error handler. Any route that calls next(err), or throws inside an
// async handler wrapped with `asyncHandler`, ends up here.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[error]', err);

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'This slot was just taken by someone else. Please pick another slot.' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error.' });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { errorHandler, asyncHandler, HttpError };
