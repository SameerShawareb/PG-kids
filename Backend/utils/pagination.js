const parsePagination = (query = {}) => {
  const rawPage = Number(query.page || 1);
  const rawLimit = Number(query.limit || 20);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const paginationMeta = ({ page, limit, count }) => ({
  page,
  limit,
  totalResults: count,
  totalPages: Math.ceil(count / limit) || 0,
});

module.exports = { parsePagination, paginationMeta };
