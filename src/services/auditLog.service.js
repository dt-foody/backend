const mongoose = require('mongoose');
const _ = require('lodash');
const logger = require('../config/logger');
const BaseService = require('../utils/_base.service'); // Kế thừa từ đây
const { AuditLog } = require('../models');

class AuditLogService extends BaseService {
  constructor() {
    super(AuditLog); // Truyền Model vào cha
  }

  /**
   * Hàm custom để ghi log (Không thuộc BaseService)
   */
  async logChange({ targetModel, targetId, oldData, newData, performer, action = 'UPDATE', note = '' }) {
    try {
      const changes = [];

      if (action === 'UPDATE' && oldData && newData) {
        const allKeys = _.union(Object.keys(oldData), Object.keys(newData));
        const ignoredFields = ['updatedAt', 'createdAt', '__v', '_id'];

        allKeys.forEach((key) => {
          if (ignoredFields.includes(key)) return;

          const oldVal = oldData[key];
          const newVal = newData[key];

          if (!_.isEqual(oldVal, newVal)) {
            // Check ObjectId
            const isIdField = mongoose.isValidObjectId(oldVal) || mongoose.isValidObjectId(newVal);
            if (isIdField && oldVal?.toString() === newVal?.toString()) {
              return;
            }

            changes.push({
              field: key,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        });

        // Nếu update mà không có change -> bỏ qua
        if (changes.length === 0 && !note) {
          logger.log('No changes detected, skipping audit log.');
          return null;
        }
      }

      // Xử lý logic tạo mới
      // if (action === 'CREATE' && newData) {
      //   const ignoredFields = ['updatedAt', 'createdAt', '__v', '_id'];
      //   Object.keys(newData).forEach((key) => {
      //     if (ignoredFields.includes(key)) return;

      //     changes.push({
      //       field: key,
      //       oldValue: null, // Trước khi tạo thì chưa có gì
      //       newValue: newData[key],
      //     });
      //   });
      // }

      // Xử lý performer ID
      let performerId = null;
      if (performer) {
        performerId = performer._id ? performer._id : performer;
      }

      // Tạo log (Dùng create của Mongoose, không dùng create của BaseService để tránh hook nếu có)
      return this.model.create({
        target: targetId,
        targetModel,
        action,
        performer: performerId,
        changes,
        note,
      });
    } catch (error) {
      logger.error(`[AuditLog Error] Failed to log:`, error);
      return null;
    }
  }
}

module.exports = new AuditLogService();
