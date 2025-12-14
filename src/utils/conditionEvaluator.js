// src/utils/conditionEvaluator.js
const _ = require('lodash');
const logger = require('../config/logger');

// ---------------------------------------------------------
// 1. FIELD RESOLVERS & METADATA
// ---------------------------------------------------------
/**
 * Cấu trúc lại để tự động nhận biết field nào cần User Context.
 * isUserDependent: true => Cần user
 */
const RESOLVER_DEFS = {
  // --- CUSTOMER INFO ---
  customer_name: {
    fn: (context) => context?.user?.profile?.name || '',
    isUserDependent: true,
  },
  customer_gender: {
    fn: (context) => context?.user?.profile?.gender || '',
    isUserDependent: true,
  },
  customer_age: {
    fn: (context) => {
      const dob = context?.user?.profile?.birthDate;
      if (!dob) return null; // Trả về null để Operator biết là không có dữ liệu
      const birth = new Date(dob);
      const diff = Date.now() - birth.getTime();
      return new Date(diff).getUTCFullYear() - 1970;
    },
    isUserDependent: true,
  },
  customer_birth_month: {
    fn: (context) => {
      const dob = context?.user?.profile?.birthDate;
      if (!dob) return null;
      return new Date(dob).getMonth() + 1;
    },
    isUserDependent: true,
  },
  customer_birth_year: {
    fn: (context) => {
      const dob = context?.user?.profile?.birthDate;
      if (!dob) return null;
      return new Date(dob).getFullYear();
    },
    isUserDependent: true,
  },
  customer_order_count: {
    fn: (context) => context?.user?.profile?.totalOrder || 0,
    isUserDependent: true,
  },

  // --- ORDER CONTEXT ---
  order_total_items: {
    fn: (context) => {
      const items = context?.user?.order?.items;
      if (!items?.length) return 0;
      return items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    },
    isUserDependent: false, // Mặc định là false nếu không khai báo, nhưng ghi rõ cho dễ đọc
  },
};

// Helper để lấy resolver function nhanh gọn
const getResolver = (fieldId) => RESOLVER_DEFS[fieldId]?.fn;

// ---------------------------------------------------------
// 2. OPERATOR STRATEGIES
// ---------------------------------------------------------
const OPERATORS = {
  // --- Text ---
  EQUALS: (a, b) => String(a) === String(b),
  IEQUALS: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(), // New: Không phân biệt hoa thường
  NOT_EQUALS: (a, b) => String(a) !== String(b),
  CONTAINS: (a, b) =>
    String(a || '')
      .toLowerCase()
      .includes(String(b || '').toLowerCase()),

  // --- Logic check null/empty ---
  IS_EMPTY: (a) => a === null || a === undefined || a === '',
  IS_NOT_EMPTY: (a) => a !== null && a !== undefined && a !== '',

  // --- Number (Safe Check) ---
  // Nếu a là null/undefined (ví dụ chưa có tuổi), phép so sánh số trả về false ngay
  GREATER_THAN: (a, b) => (a == null ? false : Number(a) > Number(b)),
  LESS_THAN: (a, b) => (a == null ? false : Number(a) < Number(b)),
  GREATER_THAN_OR_EQUALS: (a, b) => (a == null ? false : Number(a) >= Number(b)),
  LESS_THAN_OR_EQUALS: (a, b) => (a == null ? false : Number(a) <= Number(b)),

  // --- Array ---
  IN: (a, b) => {
    // Hỗ trợ b là chuỗi "A,B,C" hoặc mảng ["A", "B"]
    const list = Array.isArray(b)
      ? b
      : String(b)
          .split(',')
          .map((i) => i.trim());
    return list.includes(String(a));
  },

  NOT_IN: (a, b) => {
    const list = Array.isArray(b)
      ? b
      : String(b)
          .split(',')
          .map((i) => i.trim());
    return !list.includes(String(a));
  },
};

// ---------------------------------------------------------
// 3. LOGIC FUNCTIONS
// ---------------------------------------------------------

/**
 * Kiểm tra xem rule có cần User Context không
 * Tự động tra cứu từ RESOLVER_DEFS
 */
const requiresUserContext = (ruleNode) => {
  if (!ruleNode || _.isEmpty(ruleNode)) return false;

  // Group
  if (ruleNode.conditions && Array.isArray(ruleNode.conditions)) {
    return ruleNode.conditions.some((subRule) => requiresUserContext(subRule));
  }

  // Leaf
  if (ruleNode.fieldId) {
    // Tự động check flag trong definition -> Không cần bảo trì mảng rời rạc
    return RESOLVER_DEFS[ruleNode.fieldId]?.isUserDependent === true;
  }

  return false;
};

const evaluateConditions = (ruleNode, context) => {
  if (!ruleNode || _.isEmpty(ruleNode)) return true;

  // Group Logic (AND/OR)
  if (ruleNode.conditions && Array.isArray(ruleNode.conditions)) {
    const operator = (ruleNode.operator || 'AND').toUpperCase();
    if (operator === 'AND') return ruleNode.conditions.every((sub) => evaluateConditions(sub, context));
    if (operator === 'OR') return ruleNode.conditions.some((sub) => evaluateConditions(sub, context));
  }

  // Leaf Logic
  const { fieldId, operator, value } = ruleNode;
  const resolveFn = getResolver(fieldId);

  if (!resolveFn) {
    logger.warn(`[ConditionEvaluator] Unknown fieldId: ${fieldId}`);
    return false;
  }

  // Safe Execute Resolver
  let actualValue;
  try {
    actualValue = resolveFn(context);
  } catch (err) {
    logger.error(`[ConditionEvaluator] Error resolving field ${fieldId}`, err);
    return false;
  }

  const compareFn = OPERATORS[operator];
  if (!compareFn) {
    logger.warn(`[ConditionEvaluator] Unknown operator: ${operator}`);
    return false;
  }

  return compareFn(actualValue, value);
};

module.exports = {
  evaluateConditions,
  requiresUserContext,
};
