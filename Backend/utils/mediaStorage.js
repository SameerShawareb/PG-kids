const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const configuredUploadDir = process.env.UPLOAD_DIR;
const UPLOAD_ROOT = configuredUploadDir
  ? (path.isAbsolute(configuredUploadDir) ? configuredUploadDir : path.join(PROJECT_ROOT, configuredUploadDir))
  : path.join(PROJECT_ROOT, 'uploads');

const MEDIA_ALLOWLIST = {
  video: {
    extensions: ['.mp4', '.mov', '.webm', '.mkv'],
    mimePrefixes: ['video/'],
    mimeExact: [],
  },
  audio: {
    extensions: ['.mp3', '.wav', '.m4a', '.aac'],
    mimePrefixes: ['audio/'],
    // Some browsers/Windows builds report .m4a as video/mp4 because it is an MP4 container.
    // The extension + magic-byte checks below still enforce that the admin selected an audio file.
    mimeExact: ['video/mp4'],
  },
};

const THUMBNAIL_ALLOWLIST = {
  extensions: ['.jpg', '.jpeg', '.png', '.webp'],
  mimePrefixes: ['image/'],
  mimeExact: [],
};

const safeOriginalName = (name = 'upload.bin') => {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'upload.bin';
};

const getMediaTypeFromExtension = (filename = '') => {
  const extension = path.extname(filename || '').toLowerCase();
  if (MEDIA_ALLOWLIST.video.extensions.includes(extension)) return 'video';
  if (MEDIA_ALLOWLIST.audio.extensions.includes(extension)) return 'audio';
  return null;
};

const hasFtypBox = (buffer) => buffer.length > 12 && buffer.slice(4, 8).toString('ascii') === 'ftyp';
const hasEbmlHeader = (buffer) => buffer.length > 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
const hasMp3Header = (buffer) => buffer.slice(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
const hasWavHeader = (buffer) => buffer.length > 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WAVE';
const hasAacHeader = (buffer) => buffer.length > 2 && buffer[0] === 0xff && (buffer[1] === 0xf1 || buffer[1] === 0xf9);
const hasJpegHeader = (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const hasPngHeader = (buffer) => buffer.length > 8 && buffer[0] === 0x89 && buffer.slice(1, 4).toString('ascii') === 'PNG';
const hasWebpHeader = (buffer) => buffer.length > 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';

const validateMagicBytes = (file, extension, contentType) => {
  const buffer = file.buffer || Buffer.alloc(0);
  const ext = extension.toLowerCase();

  if (contentType === 'video') {
    if (['.mp4', '.mov'].includes(ext)) return hasFtypBox(buffer);
    if (['.webm', '.mkv'].includes(ext)) return hasEbmlHeader(buffer);
  }

  if (contentType === 'audio') {
    if (ext === '.mp3') return hasMp3Header(buffer);
    if (ext === '.wav') return hasWavHeader(buffer);
    if (ext === '.m4a') return hasFtypBox(buffer);
    if (ext === '.aac') return hasAacHeader(buffer);
  }

  if (contentType === 'thumbnail') {
    if (['.jpg', '.jpeg'].includes(ext)) return hasJpegHeader(buffer);
    if (ext === '.png') return hasPngHeader(buffer);
    if (ext === '.webp') return hasWebpHeader(buffer);
  }

  return false;
};

const validateUploadFile = (file, contentType) => {
  if (!file || !file.buffer || !file.size) {
    throw new Error('Media file is required');
  }

  const rules = MEDIA_ALLOWLIST[contentType];
  if (!rules) throw new Error('Content type must be video or audio');

  const extension = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  if (!rules.extensions.includes(extension)) {
    const detectedType = getMediaTypeFromExtension(file.originalname);
    if (detectedType && detectedType !== contentType) {
      throw new Error(`Selected content type is ${contentType}, but this file looks like ${detectedType}. Please change Content Type to ${detectedType} and upload again.`);
    }
    throw new Error(`${contentType} file extension is not supported. Allowed ${contentType} formats: ${rules.extensions.join(', ')}`);
  }

  const mimeAllowed = rules.mimePrefixes.some((prefix) => mime.startsWith(prefix)) || rules.mimeExact.includes(mime);
  if (!mimeAllowed) {
    throw new Error(`${contentType} file MIME type is not supported. Browser reported: ${mime || 'unknown'}`);
  }

  if (!validateMagicBytes(file, extension, contentType)) {
    throw new Error(`${contentType} file signature does not match an allowed format`);
  }

  return { extension, mime };
};

const validateThumbnailFile = (file) => {
  if (!file) return null;
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  if (!THUMBNAIL_ALLOWLIST.extensions.includes(extension)) {
    throw new Error('Thumbnail file extension is not supported');
  }

  const mimeAllowed = THUMBNAIL_ALLOWLIST.mimePrefixes.some((prefix) => mime.startsWith(prefix));
  if (!mimeAllowed) {
    throw new Error('Thumbnail MIME type is not supported');
  }

  if (!validateMagicBytes(file, extension, 'thumbnail')) {
    throw new Error('Thumbnail file signature does not match an allowed image format');
  }

  return { extension, mime };
};

const storeBuffer = async ({ file, subdirectory, extension }) => {
  const id = crypto.randomUUID();
  const directory = path.join(UPLOAD_ROOT, subdirectory);
  await fs.mkdir(directory, { recursive: true });

  const fileName = `${id}${extension}`;
  const absolutePath = path.join(directory, fileName);
  await fs.writeFile(absolutePath, file.buffer, { flag: 'wx' });

  const relativePath = path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');
  return {
    absolutePath,
    relativePath,
    publicUrl: `/${relativePath}`,
    safeName: safeOriginalName(file.originalname),
  };
};

module.exports = {
  validateUploadFile,
  validateThumbnailFile,
  storeBuffer,
  safeOriginalName,
  getMediaTypeFromExtension,
  UPLOAD_ROOT,
  PROJECT_ROOT,
};
