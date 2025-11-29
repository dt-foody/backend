// src/utils/conditionEvaluator.js

const _ = require('lodash');
const logger = require('../config/logger');

// ---------------------------------------------------------
// 1. OPERATOR STRATEGIES (Logic so sánh)
// ---------------------------------------------------------
const OPERATORS = {
  // --- Text / General ---
  EQUALS: (a, b) => a === b,
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
// ---------------------------------------------------------
const FIELD_RESOLVERS = {
  // --- CUSTOMER INFO (Cần User Context) ---
  customer_name: (context) => context.customer?.name || '',
  customer_gender: (context) => context.customer?.gender || '',
  customer_age: (context) => {
    const dob = context.customer?.birthDate;
    if (!dob) return null;
    const birth = new Date(dob);
    const diff = Date.now() - birth.getTime();
    // Tính tuổi tương đối chính xác
    return new Date(diff).getUTCFullYear() - 1970;
  },

  // --- ORDER HISTORY (Cần User Context) ---
  order_count: (context) => context.customer?.totalOrder || 0,

  // --- ORDER CONTEXT (Không cần User) ---
  order_total_items: (context) => {
    const items = context.order?.items;
    if (!items?.length) return 0;
    return items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  },

  // Bạn có thể thêm các field khác ở đây (ví dụ: order_total_value, shipping_city...)
};

// ---------------------------------------------------------
// 3. DEFINITION: USER DEPENDENT FIELDS
// Danh sách các trường BẮT BUỘC phải có user mới đánh giá được
// ---------------------------------------------------------
const USER_DEPENDENT_FIELDS = [
  'customer_name',
  'customer_gender',
  'customer_age',
  'order_count',
  // Thêm field mới vào đây nếu nó lấy từ context.customer
];

// ---------------------------------------------------------
// 4. HELPER FUNCTIONS
// ---------------------------------------------------------

/**
 * Kiểm tra xem bộ điều kiện có phụ thuộc vào User/Customer không
 * Dựa trên danh sách USER_DEPENDENT_FIELDS cụ thể.
 * @param {Object} ruleNode
 * @returns {boolean} True nếu cần login
 */
const requiresUserContext = (ruleNode) => {
  // 1. Nếu node rỗng -> Không cần
  if (!ruleNode || _.isEmpty(ruleNode)) return false;

  // 2. Nếu là Group (AND/OR), đệ quy kiểm tra các con
  if (ruleNode.conditions && Array.isArray(ruleNode.conditions)) {
    return ruleNode.conditions.some((subRule) => requiresUserContext(subRule));
  }

  // 3. Nếu là Leaf (Điều kiện cụ thể), check fieldId có trong whitelist không
  if (ruleNode.fieldId) {
    return USER_DEPENDENT_FIELDS.includes(ruleNode.fieldId);
  }

  return false;
};

/**
 * Đánh giá một bộ quy tắc
 * @param {Object} ruleNode - Node điều kiện (Root hoặc nested)
 * @param {Object} context - Dữ liệu runtime ({ customer, order })
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
  const { fieldId, operator, value } = ruleNode;

  // Lấy hàm resolve dữ liệu
  const resolver = FIELD_RESOLVERS[fieldId];
  if (!resolver) {
    // Nếu fieldId lạ (không có trong code), log warning và return false (hoặc true tùy policy)
    logger.warn(`[ConditionEvaluator] Unknown fieldId: ${fieldId}`);
    return false;
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

module.exports = {
  evaluateConditions,
  requiresUserContext,
};
