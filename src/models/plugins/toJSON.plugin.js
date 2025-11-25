/* eslint-disable no-param-reassign */
const he = require('he');

const deleteAtPath = (obj, path, index) => {
  if (index === path.length - 1) {
    delete obj[path[index]];
    return;
  }
  deleteAtPath(obj[path[index]], path, index + 1);
};

const toJSON = (schema) => {
  let transform;
  if (schema.options.toJSON && schema.options.toJSON.transform) {
    transform = schema.options.toJSON.transform;
  }

  // Logic transform dùng chung cho cả toJSON và toObject
  const transformer = (doc, ret, options) => {
    Object.keys(schema.paths).forEach((path) => {
      if (schema.paths[path].options && schema.paths[path].options.private) {
        deleteAtPath(ret, path.split('.'), 0);
      }
    });

    // Quan trọng: Chuyển _id -> id
    if (ret._id) {
      ret.id = ret._id;
      delete ret._id;
    }

    delete ret.__v;
    // delete ret.createdAt;
    // delete ret.updatedAt;

    if (ret.content) {
      ret.content = he.decode(ret.content);
    }

    if (transform) {
      return transform(doc, ret, options);
    }
  };

  // Áp dụng cho cả 2
  schema.options.toJSON = Object.assign(schema.options.toJSON || {}, {
    transform: transformer,
  });

  // THÊM DÒNG NÀY: Để khi gọi .toObject() trong code logic cũng tự động có id
  schema.options.toObject = Object.assign(schema.options.toObject || {}, {
    transform: transformer,
  });
};

module.exports = toJSON;
