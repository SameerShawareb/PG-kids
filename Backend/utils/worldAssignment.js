const SUPPORTED_WORLD_IDS = [];
const SUPPORTED_WORLD_SECTIONS = ['shorts', 'series'];
const WORLD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const WORLD_MARKER_PATTERN = /--world:([a-zA-Z0-9_-]+)/g;
const WORLD_SECTION_PATTERN = /--section:(shorts|series)/g;
const TITLE_AR_PATTERN = /--title_ar:([^\n\r]+)/g;
const TITLE_EN_PATTERN = /--title_en:([^\n\r]+)/g;
const INLINE_SPACE_PATTERN = /\s{2,}/g;

const sanitizeMarkerValue = (value, maxLength = 180) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/[\r\n]+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeDescription = (value) => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(INLINE_SPACE_PATTERN, ' ')
    .trim();

  return cleaned || null;
};

const normalizeWorldId = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const assertSupportedWorldId = (worldId) => {
  if (!worldId) return;
  if (!WORLD_ID_PATTERN.test(worldId)) {
    throw new Error('world_id must contain only letters, numbers, dashes or underscores (max 64 chars)');
  }
};

const stripWorldMarkers = (description) => {
  if (description === undefined || description === null) return null;

  const cleaned = String(description)
    .replace(/^\s*--world:[a-zA-Z0-9_-]+\s*$/gm, '')
    .replace(/\s*--world:[a-zA-Z0-9_-]+\s*/g, ' ')
    .replace(INLINE_SPACE_PATTERN, ' ');

  return normalizeDescription(cleaned);
};

const normalizeWorldSection = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  if (['short', 'shorts', 'video', 'videos', 'short_films'].includes(normalized)) return 'shorts';
  if (['series', 'episodes'].includes(normalized)) return 'series';
  return normalized;
};

const assertSupportedWorldSection = (section) => {
  if (!section) return;
  if (!SUPPORTED_WORLD_SECTIONS.includes(section)) {
    throw new Error(`world_section must be one of: ${SUPPORTED_WORLD_SECTIONS.join(', ')}`);
  }
};

const stripWorldSectionMarkers = (description) => {
  if (description === undefined || description === null) return null;

  const cleaned = String(description)
    .replace(/^\s*--section:(shorts|series)\s*$/gm, '')
    .replace(/\s*--section:(shorts|series)\s*/g, ' ')
    .replace(INLINE_SPACE_PATTERN, ' ');

  return normalizeDescription(cleaned);
};

const stripLocalizedTitleMarkers = (description) => {
  if (description === undefined || description === null) return null;

  const cleaned = String(description)
    .replace(/^\s*--title_ar:[^\n\r]*\s*$/gm, '')
    .replace(/^\s*--title_en:[^\n\r]*\s*$/gm, '')
    .replace(INLINE_SPACE_PATTERN, ' ');

  return normalizeDescription(cleaned);
};

const extractWorldIdFromDescription = (description) => {
  if (!description) return null;
  const matches = [...String(description).matchAll(WORLD_MARKER_PATTERN)];
  if (!matches.length) return null;

  const latestMatch = matches[matches.length - 1][1];
  return WORLD_ID_PATTERN.test(latestMatch) ? latestMatch : null;
};

const extractWorldSectionFromDescription = (description) => {
  if (!description) return null;
  const matches = [...String(description).matchAll(WORLD_SECTION_PATTERN)];
  if (!matches.length) return null;
  return matches[matches.length - 1][1];
};

const extractLocalizedTitlesFromDescription = (description) => {
  if (!description) return { title_ar: null, title_en: null };

  const arMatches = [...String(description).matchAll(TITLE_AR_PATTERN)];
  const enMatches = [...String(description).matchAll(TITLE_EN_PATTERN)];

  const title_ar = arMatches.length ? sanitizeMarkerValue(arMatches[arMatches.length - 1][1]) : null;
  const title_en = enMatches.length ? sanitizeMarkerValue(enMatches[enMatches.length - 1][1]) : null;

  return { title_ar, title_en };
};

const applyWorldAssignment = (description, worldId) => {
  const normalizedWorldId = normalizeWorldId(worldId);
  assertSupportedWorldId(normalizedWorldId);

  const cleanDescription = stripWorldMarkers(description);
  if (!normalizedWorldId) return cleanDescription;

  return cleanDescription
    ? `${cleanDescription}\n\n--world:${normalizedWorldId}`
    : `--world:${normalizedWorldId}`;
};

const applyWorldSection = (description, section) => {
  const normalizedSection = normalizeWorldSection(section);
  assertSupportedWorldSection(normalizedSection);

  const cleanDescription = stripWorldSectionMarkers(description);
  if (!normalizedSection) return cleanDescription;

  return cleanDescription
    ? `${cleanDescription}\n\n--section:${normalizedSection}`
    : `--section:${normalizedSection}`;
};

const applyLocalizedTitles = (description, titles = {}) => {
  const titleAr = sanitizeMarkerValue(titles.title_ar || titles.titleAr);
  const titleEn = sanitizeMarkerValue(titles.title_en || titles.titleEn);

  const baseDescription = stripLocalizedTitleMarkers(description);
  const markers = [
    titleAr ? `--title_ar:${titleAr}` : null,
    titleEn ? `--title_en:${titleEn}` : null,
  ].filter(Boolean);

  if (!markers.length) return baseDescription;
  return baseDescription ? `${baseDescription}\n\n${markers.join('\n')}` : markers.join('\n');
};

module.exports = {
  SUPPORTED_WORLD_IDS,
  SUPPORTED_WORLD_SECTIONS,
  WORLD_ID_PATTERN,
  normalizeWorldId,
  normalizeWorldSection,
  assertSupportedWorldId,
  assertSupportedWorldSection,
  stripWorldMarkers,
  stripWorldSectionMarkers,
  stripLocalizedTitleMarkers,
  extractWorldIdFromDescription,
  extractWorldSectionFromDescription,
  extractLocalizedTitlesFromDescription,
  applyWorldAssignment,
  applyWorldSection,
  applyLocalizedTitles,
};
