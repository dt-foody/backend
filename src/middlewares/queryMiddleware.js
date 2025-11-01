const queryMiddleware = (req, res, next) => {
  const { populate, sortBy, select } = req.query;
  let { page = 1, limit = 20 } = req.query;

  // Chuyển đổi kiểu dữ liệu
  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  // Nếu giá trị không hợp lệ, đặt giá trị mặc định
  if (Number.isNaN(page) || page <= 0) page = 1;
  if (Number.isNaN(limit) || limit <= 0) limit = 20;

  delete req.query.page;
  delete req.query.limit;
  delete req.query.sortBy;
  delete req.query.populate;

  if (req.query.search) {
    req.query.search = req.query.search ? req.query.search.trim() : '';
  }

  Object.keys(req.query).forEach((key) => {
    if (req.query[key] === 'null') {
      req.query[key] = null;
    } else if (req.query[key] === 'true') {
      req.query[key] = true;
    } else if (req.query[key] === 'false') {
      req.query[key] = false;
    }
  });

  req.options = {
    page,
    limit,
    sortBy,
  };

  if (populate) {
    const buildNestedPopulate = (populateStr) => {
      const populateMap = {};

      populateStr.split(';').forEach((entry) => {
        const [fullPath, selectFields] = entry.split(':');
        const parts = fullPath.split('.');

        let current = populateMap;

        for (let i = 0; i < parts.length; i += 1) {
          const part = parts[i];

          if (!current[part]) current[part] = {};
          if (i === parts.length - 1) {
            if (selectFields) current[part]._select = selectFields.split(',').join(' ');
          }

          if (!current[part]._populate) current[part]._populate = {};
          current = current[part]._populate;
        }
      });

      const convert = (map) => {
        return Object.entries(map).map(([path, value]) => {
          const obj = { path };
          if (value._select) obj.select = value._select;
          const nested = convert(value._populate || {});
          if (nested.length) obj.populate = nested;
          return obj;
        });
      };

      return convert(populateMap);
    };

    const nestedPopulate = buildNestedPopulate(populate);

    req.options.populate = nestedPopulate;
  }

  if (sortBy) {
    req.options.sortBy = sortBy;
  }

  if (select) {
    req.options.select = select;
  }

  next();
};

module.exports = queryMiddleware;