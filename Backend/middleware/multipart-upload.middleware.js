const { error } = require('../utils/apiResponse');

const DEFAULT_MAX_UPLOAD_BYTES = Number(process.env.MAX_MEDIA_FILE_SIZE_MB || 100) * 1024 * 1024;
const MAX_FIELDS = 60;

const parseContentDisposition = (value = '') => {
  const result = {};
  value.split(';').forEach((piece) => {
    const [rawKey, ...rawValue] = piece.trim().split('=');
    const key = rawKey?.trim();
    if (!key) return;
    result[key] = rawValue.join('=').replace(/^"|"$/g, '');
  });
  return result;
};

const parseHeaders = (headerText) => {
  return headerText.split('\r\n').reduce((acc, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return acc;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
};

const multipartUpload = ({ maxBytes = DEFAULT_MAX_UPLOAD_BYTES } = {}) => (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return error(res, 415, 'Content-Type must be multipart/form-data');
  }

  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) {
    return error(res, 400, 'Multipart boundary is missing');
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength && contentLength > maxBytes) {
    return error(res, 413, `Uploaded payload exceeds the configured limit of ${Math.round(maxBytes / 1024 / 1024)} MB`);
  }

  const chunks = [];
  let totalBytes = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    if (aborted) return;
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      aborted = true;
      return req.destroy(new Error('PAYLOAD_TOO_LARGE'));
    }
    chunks.push(chunk);
  });

  req.on('error', (err) => {
    if (err.message === 'PAYLOAD_TOO_LARGE') {
      return error(res, 413, `Uploaded payload exceeds the configured limit of ${Math.round(maxBytes / 1024 / 1024)} MB`);
    }
    console.error('Upload stream error:', err.message);
    return error(res, 400, 'Unable to read uploaded file');
  });

  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const delimiter = Buffer.from(`--${boundary}`);
      const fields = {};
      const files = [];
      let partStart = buffer.indexOf(delimiter);
      let fieldCount = 0;

      while (partStart !== -1) {
        partStart += delimiter.length;
        if (buffer.slice(partStart, partStart + 2).toString() === '--') break;
        if (buffer.slice(partStart, partStart + 2).toString() === '\r\n') partStart += 2;

        const nextBoundary = buffer.indexOf(delimiter, partStart);
        if (nextBoundary === -1) break;

        let part = buffer.slice(partStart, nextBoundary);
        if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);

        const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd !== -1) {
          const headers = parseHeaders(part.slice(0, headerEnd).toString('utf8'));
          const contentDisposition = parseContentDisposition(headers['content-disposition']);
          const body = part.slice(headerEnd + 4);
          const fieldName = contentDisposition.name;

          if (fieldName) {
            if (contentDisposition.filename !== undefined) {
              files.push({
                fieldname: fieldName,
                originalname: contentDisposition.filename,
                mimetype: headers['content-type'] || 'application/octet-stream',
                buffer: body,
                size: body.length,
              });
            } else {
              fieldCount += 1;
              if (fieldCount > MAX_FIELDS) {
                return error(res, 400, 'Too many form fields');
              }
              fields[fieldName] = body.toString('utf8');
            }
          }
        }

        partStart = nextBoundary;
      }

      req.body = fields;
      req.files = files;
      req.file = files.find((file) => file.fieldname === 'file') || null;
      req.thumbnailFile = files.find((file) => file.fieldname === 'thumbnail') || null;
      return next();
    } catch (err) {
      console.error('Multipart parsing error:', err.message);
      return error(res, 400, 'Invalid multipart upload payload');
    }
  });
};

module.exports = { multipartUpload };
