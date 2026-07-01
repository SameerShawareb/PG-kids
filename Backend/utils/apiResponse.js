const success = (res, statusCode, message, data = null, meta = undefined) => {
  const payload = { success: true, message };
  if (data !== null && data !== undefined) payload.data = data;
  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const error = (res, statusCode, message, details = undefined) => {
  const payload = { success: false, message, errors: [] };
  if (details !== undefined) {
    payload.errors = Array.isArray(details) ? details : [details];
  }
  return res.status(statusCode).json(payload);
};

module.exports = { success, error };
