// Shared input bounds for D1-backed user content.

export const INPUT_LIMITS = {
  categoryName: 80,
  bookmarkName: 120,
  bookmarkUrl: 2048,
  bookmarkLogo: 2048,
  bookmarkDesc: 1000,
  importCategories: 2000,
  importSites: 10000,
};

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
}

function validateTextLength(text, label, maxLength) {
  if (text.length > maxLength) {
    return { ok: false, message: `${label}不能超过 ${maxLength} 个字符` };
  }
  return { ok: true };
}

export function normalizeRequiredText(value, label, maxLength) {
  const text = normalizeText(value);
  if (!text) {
    return { ok: false, message: `${label}不能为空` };
  }

  const lengthCheck = validateTextLength(text, label, maxLength);
  if (!lengthCheck.ok) return lengthCheck;

  return { ok: true, value: text };
}

export function normalizeOptionalText(value, label, maxLength, options = {}) {
  const text = normalizeText(value);
  if (!text) {
    return { ok: true, value: options.nullIfEmpty ? null : '' };
  }

  const lengthCheck = validateTextLength(text, label, maxLength);
  if (!lengthCheck.ok) return lengthCheck;

  return { ok: true, value: text };
}

export function normalizeCategoryName(value) {
  return normalizeRequiredText(value, '分类名称', INPUT_LIMITS.categoryName);
}

export function normalizeBookmarkName(value) {
  return normalizeRequiredText(value, '书签名称', INPUT_LIMITS.bookmarkName);
}

export function normalizeBookmarkUrl(value) {
  return normalizeRequiredText(value, 'URL', INPUT_LIMITS.bookmarkUrl);
}

export function normalizeOptionalBookmarkUrl(value) {
  return normalizeOptionalText(value, 'URL', INPUT_LIMITS.bookmarkUrl);
}

export function normalizeBookmarkLogo(value, options = {}) {
  return normalizeOptionalText(value, 'Logo', INPUT_LIMITS.bookmarkLogo, options);
}

export function normalizeBookmarkDesc(value, options = {}) {
  return normalizeOptionalText(value, '描述', INPUT_LIMITS.bookmarkDesc, options);
}

export function validateImportSizes(categories, sites) {
  if (Array.isArray(categories) && categories.length > INPUT_LIMITS.importCategories) {
    return { ok: false, message: `导入分类数量不能超过 ${INPUT_LIMITS.importCategories} 个` };
  }

  if (Array.isArray(sites) && sites.length > INPUT_LIMITS.importSites) {
    return { ok: false, message: `导入书签数量不能超过 ${INPUT_LIMITS.importSites} 个` };
  }

  return { ok: true };
}
