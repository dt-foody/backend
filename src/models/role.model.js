// models/role.model.js
const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins/index.js');

const { Schema } = mongoose;

const RoleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

RoleSchema.plugin(toJSON);
RoleSchema.plugin(paginate);

const Role = mongoose.model('Role', RoleSchema);
module.exports = Role;
