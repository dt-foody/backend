// src/utils/conditionEvaluator.js

const _ = require('lodash'); // Dùng lodash để get nested safe (tuỳ chọn)
const logger = require('../config/logger');

// ---------------------------------------------------------
// 1. OPERATOR STRATEGIES (Logic so sánh)
// ---------------------------------------------------------
const OPERATORS = {
  // --- Text / General ---
  EQUALS: (a, b) => a === b, // Dùng == để auto cast string/number nếu cần
  NOT_EQUALS: (a, b) => a !== b,
  CONTAINS: (a, b) =>
    (a || '')
      .toString()
      .toLowerCase()
      .includes((b || '').toString().toLowerCase()),
  DOES_NOT_CONTAIN: (a, b) =>
    !(a || '')
      .toString()
      .toLowerCase()
      .includes((b || '').toString().toLowerCase()),
  IS_EMPTY: (a) => a === null || a === undefined || a === '',
  IS_NOT_EMPTY: (a) => a !== null && a !== undefined && a !== '',

  // --- Number ---
  GREATER_THAN: (a, b) => Number(a) > Number(b),
  LESS_THAN: (a, b) => Number(a) < Number(b),
  GREATER_THAN_OR_EQUALS: (a, b) => Number(a) >= Number(b),
  LESS_THAN_OR_EQUALS: (a, b) => Number(a) <= Number(b),

  // --- Boolean ---
  // (EQUALS handle được rồi, nhưng nếu cần explicit)
  IS_TRUE: (a) => a === true,
  IS_FALSE: (a) => a === false,

  // --- Date (So sánh timestamp) ---
  BEFORE: (a, b) => new Date(a).getTime() < new Date(b).getTime(),
  AFTER: (a, b) => new Date(a).getTime() > new Date(b).getTime(),
  BETWEEN: (a, [start, end]) => {
    const time = new Date(a).getTime();
    return time >= new Date(start).getTime() && time <= new Date(end).getTime();
  },

  // --- Array / Multi-select ---
  IN: (a, b) => Array.isArray(b) && b.includes(a),
  NOT_IN: (a, b) => Array.isArray(b) && !b.includes(a),
};

// ---------------------------------------------------------
// 2. FIELD RESOLVERS (Mapper dữ liệu)
// Context gồm: { user, order, summary }
// ---------------------------------------------------------
const FIELD_RESOLVERS = {
  // --- Group: Khách hàng ---
  customer_name: (context) => context.user?.name,

  customer_age: (context) => {
    if (!context.user?.dateOfBirth) return null;
    const dob = new Date(context.user.dateOfBirth);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  },

  customer_is_new: (context) => {
    // Ví dụ: User tạo trong vòng 7 ngày được gọi là mới
    if (!context.user?.createdAt) return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(context.user.createdAt) > sevenDaysAgo;
  },

  // --- Group: Đơn hàng (Context order hiện tại) ---
  order_count: (context) => context.user?.orderStats?.totalOrders || 0, // Cần aggregate trước hoặc lưu trong user

  order_date: (context) => context.order?.createdAt || new Date(),

  order_contains_product_count: (context) => {
    // Đếm tổng số lượng item trong giỏ
    if (!context.order?.items) return 0;
    return context.order.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  // --- Group: Sản phẩm / Danh mục (Mở rộng sau này) ---
  product_id: (context) => context.order?.items?.map((i) => i.product.id), // Trả về mảng ID để dùng operator IN
  category_id: (context) => context.order?.items?.map((i) => i.product.categoryId),
};

// ---------------------------------------------------------
// 3. MAIN EVALUATOR
// ---------------------------------------------------------
/**
 * Đánh giá một bộ quy tắc
 * @param {Object} ruleNode - Node điều kiện (Root hoặc nested)
 * @param {Object} context - Dữ liệu runtime ({ user, order })
 * @returns {boolean}
 */
const evaluateConditions = (ruleNode, context) => {
  // 1. Trường hợp không có điều kiện -> Mặc định true
  if (!ruleNode || _.isEmpty(ruleNode)) return true;

  // 2. Nếu là Group (AND/OR)
  if (ruleNode.conditions && Array.isArray(ruleNode.conditions)) {
    const operator = (ruleNode.operator || 'AND').toUpperCase();

    if (operator === 'AND') {
      // Tất cả con phải true
      return ruleNode.conditions.every((subRule) => evaluateConditions(subRule, context));
    }

    if (operator === 'OR') {
      // Chỉ cần 1 con true
      return ruleNode.conditions.some((subRule) => evaluateConditions(subRule, context));
    }
  }

  // 3. Nếu là Leaf (Điều kiện cụ thể)
  // ruleNode dạng: { fieldId: 'customer_age', operator: 'GREATER_THAN', value: 18 }
  const { fieldId, operator, value } = ruleNode;

  // Lấy hàm resolve dữ liệu
  const resolver = FIELD_RESOLVERS[fieldId];
  if (!resolver) {
    logger.warn(`[ConditionEvaluator] Unknown fieldId: ${fieldId}`);
    return false; // Hoặc true tuỳ policy
  }

  // Lấy giá trị thực tế từ context
  const actualValue = resolver(context);

  // Lấy hàm so sánh
  const compareFn = OPERATORS[operator];
  if (!compareFn) {
    logger.warn(`[ConditionEvaluator] Unknown operator: ${operator}`);
    return false;
  }

  // Thực thi so sánh
  return compareFn(actualValue, value);
};

module.exports = { evaluateConditions };
