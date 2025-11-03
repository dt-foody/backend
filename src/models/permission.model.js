// models/permission.model.js
const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const { Schema } = mongoose;

const PermissionSchema = new Schema(
  {
    resource: { type: String, required: true, trim: true }, // VD: 'product'
    action: { type: String, required: true, trim: true }, // VD: 'create'
    name: { type: String, required: true, unique: true }, // VD: 'product.create'
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

// Tự động sinh name nếu thiếu
PermissionSchema.pre('validate', function (next) {
  if (!this.name && this.resource && this.action) {
    this.name = `${this.resource}.${this.action}`;
  }
  next();
});

PermissionSchema.plugin(toJSON);
PermissionSchema.plugin(paginate);

const Permission = mongoose.model('Permission', PermissionSchema);
module.exports = Permission;
