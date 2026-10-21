// 从 JPEG 的 APP1 段里读取拍摄时间。只读需要的两个标签：
// DateTimeOriginal (0x9003) 优先，其次 DateTime (0x0132)；都没有时由调用方回退到文件时间。
const TAG_DATE_TIME = 0x0132;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_EXIF_IFD = 0x8769;

function readAscii(view, offset, length) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const code = view.getUint8(offset + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

// EXIF 的时间写成 "2026:02:14 09:31:07"，需要转成本地时间的 Date。
function parseExifDate(raw) {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readIfd(view, tiffStart, ifdOffset, little, found) {
  const base = tiffStart + ifdOffset;
  if (base + 2 > view.byteLength) return;
  const count = view.getUint16(base, little);
  for (let i = 0; i < count; i += 1) {
    const entry = base + 2 + i * 12;
    if (entry + 12 > view.byteLength) return;
    const tag = view.getUint16(entry, little);
    const valueOffset = view.getUint32(entry + 8, little);
    if (tag === TAG_EXIF_IFD) {
      readIfd(view, tiffStart, valueOffset, little, found);
    } else if (tag === TAG_DATE_TIME_ORIGINAL || tag === TAG_DATE_TIME) {
      const length = view.getUint32(entry + 4, little);
      const at = tiffStart + valueOffset;
      if (at + length <= view.byteLength) {
        const parsed = parseExifDate(readAscii(view, at, length));
        if (parsed) {
          if (tag === TAG_DATE_TIME_ORIGINAL) found.original = parsed;
          else found.fallback = parsed;
        }
      }
    }
  }
}

function readExifDate(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      const header = readAscii(view, offset + 4, 4);
      if (header === "Exif") {
        const tiffStart = offset + 10;
        const endian = view.getUint16(tiffStart);
        const little = endian === 0x4949;
        const firstIfd = view.getUint32(tiffStart + 4, little);
        const found = { original: null, fallback: null };
        readIfd(view, tiffStart, firstIfd, little, found);
        return found.original || found.fallback;
      }
    }
    if (marker === 0xda) break;
    offset += 2 + size;
  }
  return null;
}

// 相机没设过时间是常事，EXIF 里会写着 1980 年；也见过写成 2098 年的。
// 这种日期照单全收，照片就会被扔到相册最末尾或最前面，再也翻不到。
// 所以超出合理范围的一律当作读不到，退回文件时间。
function plausible(date) {
  if (!date || Number.isNaN(date.getTime())) return false;
  const year = date.getFullYear();
  const tomorrow = Date.now() + 86400000;
  return year >= 1990 && date.getTime() <= tomorrow;
}

export async function shotTimeOf(file) {
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    const exifDate = readExifDate(head);
    if (plausible(exifDate)) return { at: exifDate, source: "exif" };
  } catch {
    // 读取失败时不阻断上传，交给文件时间兜底。
  }
  const stamp = file.lastModified ? new Date(file.lastModified) : new Date();
  return { at: plausible(stamp) ? stamp : new Date(), source: "file" };
}
