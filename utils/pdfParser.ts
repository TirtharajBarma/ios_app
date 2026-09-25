import * as fflate from 'fflate';

export interface PositionedTextItem {
  text: string;
  x: number;
  y: number;
  font: string;
  page: number;
}

export interface ParsedPdfRow {
  y: number;
  page: number;
  items: PositionedTextItem[];
}

export interface ParsedPdfResult {
  pages: {
    pageNum: number;
    rows: ParsedPdfRow[];
    items: PositionedTextItem[];
  }[];
  allRows: ParsedPdfRow[];
  rawText: string;
}

/**
 * Fast, 100% memory-safe Base64 to Uint8Array converter (zero native dependency)
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[\r\n\s]/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = clean.length * 0.75;
  if (clean[clean.length - 1] === '=') bufferLength--;
  if (clean[clean.length - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(Math.max(0, Math.floor(bufferLength)));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const encoded1 = lookup[clean.charCodeAt(i)];
    const encoded2 = lookup[clean.charCodeAt(i + 1)];
    const encoded3 = lookup[clean.charCodeAt(i + 2)];
    const encoded4 = lookup[clean.charCodeAt(i + 3)];

    if (p < bytes.length) bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (clean[i + 2] !== '=' && p < bytes.length) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (clean[i + 3] !== '=' && p < bytes.length) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
}

/**
 * Fast, call-stack safe Uint8Array to Latin1 string conversion.
 * Uses 1024-byte chunks to prevent Hermes / JavaScriptCore stack overflow errors.
 */
export function uint8ToLatin1(bytes: Uint8Array): string {
  let str = '';
  const len = bytes.length;
  const chunkSize = 1024;
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    for (let j = i; j < end; j++) {
      str += String.fromCharCode(bytes[j]);
    }
  }
  return str;
}

/**
 * Checks if a PDF is password protected / encrypted
 */
export function isPdfEncrypted(uint8Data: Uint8Array): boolean {
  const scanLen = Math.min(uint8Data.length, 32768);
  let str = '';
  for (let i = 0; i < scanLen; i++) {
    str += String.fromCharCode(uint8Data[i]);
  }
  return str.includes('/Encrypt') || str.includes('/Filter /Standard');
}

// Standard MacRomanEncoding map for byte codes >= 128
const MAC_ROMAN_MAP: Record<number, string> = {
  0x80: 'Ä', 0x81: 'Å', 0x82: 'Ç', 0x83: 'É', 0x84: 'Ñ', 0x85: 'Ö', 0x86: 'Ü', 0x87: 'á',
  0x88: 'à', 0x89: 'â', 0x8a: 'ä', 0x8b: 'ã', 0x8c: 'å', 0x8d: 'ç', 0x8e: 'é', 0x8f: 'è',
  0x90: 'ê', 0x91: 'ë', 0x92: 'í', 0x93: 'ì', 0x94: 'î', 0x95: 'ï', 0x96: 'ñ', 0x97: 'ó',
  0x98: 'ò', 0x99: 'ô', 0x9a: 'ö', 0x9b: 'õ', 0x9c: 'ú', 0x9d: 'ù', 0x9e: 'û', 0x9f: 'ü',
  0xa0: '†', 0xa1: '°', 0xa2: '¢', 0xa3: '£', 0xa4: '§', 0xa5: '•', 0xa6: '¶', 0xa7: 'ß',
  0xa8: '®', 0xa9: '©', 0xaa: '™', 0xab: '´', 0xac: '¨', 0xad: '≠', 0xae: 'Æ', 0xaf: 'Ø',
  0xb0: '∞', 0xb1: '±', 0xb2: '≤', 0xb3: '≥', 0xb4: '¥', 0xb5: 'µ', 0xb6: '∂', 0xb7: '∑',
  0xb8: '∏', 0xb9: 'π', 0xba: '∫', 0xbb: 'ª', 0xbc: 'º', 0xbd: 'Ω', 0xbe: 'æ', 0xbf: 'ø',
  0xc0: '¿', 0xc1: '¡', 0xc2: '¬', 0xc3: '√', 0xc4: 'ƒ', 0xc5: '≈', 0xc6: '∆', 0xc7: '«',
  0xc8: '»', 0xc9: '…', 0xca: ' ', 0xcb: 'À', 0xcc: 'Ã', 0xcd: 'Õ', 0xce: 'Œ', 0xcf: 'œ',
  0xd0: '–', 0xd1: '—', 0xd2: '“', 0xd3: '”', 0xd4: '‘', 0xd5: '’', 0xd6: '÷', 0xd7: '◊',
  0xd8: 'ÿ', 0xd9: 'Ÿ', 0xda: '⁄', 0xdb: '€', 0xdc: '‹', 0xdd: '›', 0xde: 'ﬁ', 0xdf: 'ﬂ',
  0xe0: '‡', 0xe1: '·', 0xe2: '‚', 0xe3: '„', 0xe4: '‰', 0xe5: 'Â', 0xe6: 'Ê', 0xe7: 'Á',
  0xe8: 'Ë', 0xe9: 'È', 0xea: 'Í', 0xeb: 'Î', 0xec: 'Ï', 0xed: 'Ì', 0xee: 'Ó', 0xef: 'Ô',
  0xf0: '', 0xf1: 'Ò', 0xf2: 'Ú', 0xf3: 'Û', 0xf4: 'Ù', 0xf5: 'ı', 0xf6: 'ˆ', 0xf7: '˜',
  0xf8: '¯', 0xf9: '˘', 0xfa: '˙', 0xfb: '˚', 0xfc: '¸', 0xfd: '˝', 0xfe: '˛', 0xff: 'ˇ',
};

// Standard WinAnsiEncoding map for byte codes >= 128
const WIN_ANSI_MAP: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ',
  0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“',
  0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ', 0xa0: ' ', 0xa1: '¡', 0xa2: '¢', 0xa3: '£', 0xa4: '¤',
  0xa5: '¥', 0xa6: '¦', 0xa7: '§', 0xa8: '¨', 0xa9: '©', 0xaa: 'ª', 0xab: '«', 0xac: '¬',
  0xad: '-', 0xae: '®', 0xaf: '¯', 0xb0: '°', 0xb1: '±', 0xb2: '²', 0xb3: '³', 0xb4: '´',
  0xb5: 'µ', 0xb6: '¶', 0xb7: '·', 0xb8: '¸', 0xb9: '¹', 0xba: 'º', 0xbb: '»', 0xbc: '¼',
  0xbd: '½', 0xbe: '¾', 0xbf: '¿',
};

/**
 * Universal on-device PDF parser engine.
 * Robustly parses PDF streams, resolves ToUnicode CMaps & Font Encodings,
 * tokenizes operators (BT, ET, Tf, Tm, Td, TD, T*, TJ, Tj, '), and reconstructs
 * spatial rows with character and currency mappings.
 */
export function parsePdfDocument(uint8Data: Uint8Array): ParsedPdfResult {
  console.log('[PDF] parsePdfDocument START — byteLength:', uint8Data.byteLength, 'byteOffset:', uint8Data.byteOffset);

  let latin1Str: string;
  try {
    latin1Str = uint8ToLatin1(uint8Data);
    console.log('[PDF] uint8ToLatin1 OK — string length:', latin1Str.length);
  } catch (e) {
    console.error('[PDF] uint8ToLatin1 FAILED:', e);
    throw e;
  }

  // 1. Find all PDF objects: "X Y obj ... endobj"
  const objects: Record<string, { body: string; fullObjText: string; index: number }> = {};
  const objHeaderRegex = /\b(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;

  try {
    while ((m = objHeaderRegex.exec(latin1Str)) !== null) {
      const objNum = m[1];
      const startIndex = m.index;
      const bodyStart = startIndex + m[0].length;

      // Search for matching endobj safely
      let endObjIndex = latin1Str.indexOf('endobj', bodyStart);
      if (endObjIndex === -1) endObjIndex = latin1Str.length;

      // Check if object contains a stream — if so, find endstream first
      const streamMarker = latin1Str.indexOf('stream', bodyStart);
      if (streamMarker !== -1 && streamMarker < endObjIndex) {
        const endStreamIndex = latin1Str.indexOf('endstream', streamMarker);
        if (endStreamIndex !== -1) {
          const afterEndStream = latin1Str.indexOf('endobj', endStreamIndex);
          if (afterEndStream !== -1) {
            endObjIndex = afterEndStream;
          }
        }
      }

      const fullObjText = latin1Str.slice(startIndex, endObjIndex + 6);
      const body = latin1Str.slice(bodyStart, endObjIndex);
      objects[objNum] = { body, fullObjText, index: startIndex };
    }
    console.log('[PDF] Object scan OK — found objects:', Object.keys(objects).join(','));
  } catch (e) {
    console.error('[PDF] Object scan FAILED:', e);
    throw e;
  }

  // 2. Decompress all streams (FlateDecode)
  const decompressedStreams: Record<string, string> = {};
  for (const id in objects) {
    const { body, fullObjText, index } = objects[id];
    const streamIdx = fullObjText.indexOf('stream');
    if (streamIdx !== -1) {
      let afterStream = streamIdx + 6;
      if (fullObjText.charCodeAt(afterStream) === 13) afterStream++; // \r
      if (fullObjText.charCodeAt(afterStream) === 10) afterStream++; // \n
      const streamStart = index + afterStream;

      let streamLen: number | null = null;
      // Check indirect /Length e.g. /Length 12 0 R
      const indirectLenMatch = body.match(/\/Length\s+(\d+)\s+\d+\s+R/);
      if (indirectLenMatch) {
        const lenObjId = indirectLenMatch[1];
        const lenObjBody = objects[lenObjId]?.body?.trim();
        if (lenObjBody) {
          const num = parseInt(lenObjBody, 10);
          if (!isNaN(num) && num > 0) streamLen = num;
        }
      } else {
        const directLenMatch = body.match(/\/Length\s+(\d+)/);
        if (directLenMatch) {
          streamLen = parseInt(directLenMatch[1], 10);
        }
      }

      // Use .slice() not .subarray() — slice() creates a zero-byteOffset copy
      // which is required by fflate on Hermes (React Native JS engine).
      // subarray() creates a view with non-zero byteOffset that causes fflate to fail on device.
      let streamBytes: Uint8Array;
      if (streamLen !== null && streamStart + streamLen <= uint8Data.length) {
        streamBytes = uint8Data.slice(streamStart, streamStart + streamLen);
      } else {
        const endStreamIdx = latin1Str.indexOf('endstream', streamStart);
        streamBytes = uint8Data.slice(
          streamStart,
          endStreamIdx !== -1 ? endStreamIdx : uint8Data.length
        );
      }

      const hasFlateDecode = body.includes('/Filter') && (body.includes('/FlateDecode') || body.includes('/Fl'));
      console.log(`[PDF] obj ${id}: streamStart=${streamStart} streamLen=${streamLen} sliceLen=${streamBytes.length} hasFlateDecode=${hasFlateDecode} sliceByteOffset=${streamBytes.byteOffset}`);

      if (hasFlateDecode) {
        try {
          const dec = fflate.unzlibSync(streamBytes);
          decompressedStreams[id] = uint8ToLatin1(dec);
          console.log(`[PDF] obj ${id}: unzlibSync OK — decompressed ${dec.length} bytes`);
        } catch (e1) {
          console.warn(`[PDF] obj ${id}: unzlibSync failed (${e1}), trying inflateSync...`);
          try {
            const dec = fflate.inflateSync(streamBytes);
            decompressedStreams[id] = uint8ToLatin1(dec);
            console.log(`[PDF] obj ${id}: inflateSync OK — decompressed ${dec.length} bytes`);
          } catch (e2) {
            console.warn(`[PDF] obj ${id}: inflateSync failed (${e2}), trying endstream fallback...`);
            // Fallback: try locating endstream if streamLen was slightly off
            const fallbackEnd = latin1Str.indexOf('endstream', streamStart);
            if (fallbackEnd !== -1) {
              const fallbackBytes = uint8Data.slice(streamStart, fallbackEnd);
              console.log(`[PDF] obj ${id}: fallback slice len=${fallbackBytes.length}`);
              try {
                const dec = fflate.unzlibSync(fallbackBytes);
                decompressedStreams[id] = uint8ToLatin1(dec);
                console.log(`[PDF] obj ${id}: fallback unzlibSync OK`);
              } catch (e3) {
                try {
                  const dec = fflate.inflateSync(fallbackBytes);
                  decompressedStreams[id] = uint8ToLatin1(dec);
                  console.log(`[PDF] obj ${id}: fallback inflateSync OK`);
                } catch (e4) {
                  console.warn(`[PDF] obj ${id}: ALL decompress failed (${e4}), using raw bytes`);
                  decompressedStreams[id] = uint8ToLatin1(streamBytes);
                }
              }
            } else {
              console.warn(`[PDF] obj ${id}: no endstream found for fallback, using raw bytes`);
              decompressedStreams[id] = uint8ToLatin1(streamBytes);
            }
          }
        }
      } else {
        decompressedStreams[id] = uint8ToLatin1(streamBytes);
      }
    }
  }
  console.log('[PDF] Decompression done — streams:', Object.keys(decompressedStreams).join(','));
  // 3. Parse CMaps (/ToUnicode)
  const cmaps: Record<string, Record<number, string>> = {};
  for (const id in decompressedStreams) {
    const text = decompressedStreams[id];
    if (
      text.includes('/CIDInit') ||
      text.includes('beginbfchar') ||
      text.includes('beginbfrange')
    ) {
      const map: Record<number, string> = {};

      // beginbfchar: <codeHex> <unicodeHex>
      const bfcharRegex = /(\d+)\s+beginbfchar([\s\S]*?)endbfchar/g;
      let bfcMatch: RegExpExecArray | null;
      while ((bfcMatch = bfcharRegex.exec(text)) !== null) {
        const lines = bfcMatch[2].trim().split(/\r?\n/);
        for (const line of lines) {
          const parts = line.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F\s]+)>/);
          if (parts) {
            const code = parseInt(parts[1], 16);
            const hex = parts[2].replace(/\s+/g, '');
            let uni = '';
            for (let i = 0; i < hex.length; i += 4) {
              uni += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16));
            }
            map[code] = uni;
          }
        }
      }

      // beginbfrange: <startHex> <endHex> <targetHex> or array
      const bfrangeRegex = /(\d+)\s+beginbfrange([\s\S]*?)endbfrange/g;
      let bfrMatch: RegExpExecArray | null;
      while ((bfrMatch = bfrangeRegex.exec(text)) !== null) {
        const lines = bfrMatch[2].trim().split(/\r?\n/);
        for (const line of lines) {
          const parts = line.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
          if (parts) {
            const start = parseInt(parts[1], 16);
            const end = parseInt(parts[2], 16);
            const targetHex = parts[3];
            let target = parseInt(targetHex, 16);
            for (let code = start; code <= end; code++) {
              map[code] = String.fromCharCode(target);
              target++;
            }
          }
        }
      }

      cmaps[id] = map;
    }
  }
  console.log('[PDF] CMaps parsed — cmap ids:', Object.keys(cmaps).join(','));

  // 4. Map Font Resources to their CMaps & Encodings
  const fontDicts: Record<string, { cmap?: Record<number, string>; encoding?: string }> = {};
  for (const id in objects) {
    const body = objects[id].body;
    if (body.includes('/Font') && (body.includes('/Font <<') || body.includes('/Font<<') || body.includes('/Font '))) {
      const fontBlock = body.match(/\/Font\s*<<([\s\S]*?)>>/);
      if (fontBlock) {
        const fontEntryRegex = /\/([A-Za-z0-9_]+)\s+(\d+)\s+\d+\s+R/g;
        let feMatch: RegExpExecArray | null;
        while ((feMatch = fontEntryRegex.exec(fontBlock[1])) !== null) {
          const fName = '/' + feMatch[1];
          const fObjId = feMatch[2];
          const fObj = objects[fObjId]?.body || '';

          const toUniMatch = fObj.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
          const toUniId = toUniMatch ? toUniMatch[1] : null;

          let encoding = '';
          if (fObj.includes('/MacRomanEncoding')) encoding = 'MacRomanEncoding';
          else if (fObj.includes('/WinAnsiEncoding')) encoding = 'WinAnsiEncoding';

          fontDicts[fName] = {
            cmap: toUniId ? cmaps[toUniId] : undefined,
            encoding,
          };
        }
      }
    }
  }
  console.log('[PDF] Fonts resolved:', Object.keys(fontDicts).join(','));

  // 5. Find Pages & their Content Stream references (support both single /Contents and arrays)
  const pageList: Array<{ pageObj: string; streamIds: string[] }> = [];
  for (const id in objects) {
    const body = objects[id].body;
    if (
      (body.includes('/Type /Page') || body.includes('/Type/Page')) &&
      !body.includes('/Pages')
    ) {
      const streamIds: string[] = [];
      const arrayMatch = body.match(/\/Contents\s*\[([\s\S]*?)\]/);
      if (arrayMatch) {
        const idRegex = /(\d+)\s+\d+\s+R/g;
        let idM: RegExpExecArray | null;
        while ((idM = idRegex.exec(arrayMatch[1])) !== null) {
          streamIds.push(idM[1]);
        }
      } else {
        const singleMatch = body.match(/\/Contents\s+(\d+)\s+\d+\s+R/);
        if (singleMatch) {
          streamIds.push(singleMatch[1]);
        }
      }

      if (streamIds.length > 0) {
        pageList.push({ pageObj: id, streamIds });
      }
    }
  }
  console.log('[PDF] Pages found:', pageList.length, '— streamIds per page:', pageList.map(p => p.streamIds.join(',')).join(' | '));

  // Helper string decoders
  function decodePdfString(str: string, cmap?: Record<number, string>, encoding?: string): string {
    let res = '';
    const unescaped = str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

    for (let i = 0; i < unescaped.length; i++) {
      const code = unescaped.charCodeAt(i);
      if (cmap && cmap[code] !== undefined) {
        res += cmap[code];
      } else if (code >= 128) {
        if (encoding === 'MacRomanEncoding' && MAC_ROMAN_MAP[code]) {
          res += MAC_ROMAN_MAP[code];
        } else if (encoding === 'WinAnsiEncoding' && WIN_ANSI_MAP[code]) {
          res += WIN_ANSI_MAP[code];
        } else {
          res += unescaped[i];
        }
      } else {
        res += unescaped[i];
      }
    }
    return res;
  }

  function decodeHex(hex: string, cmap?: Record<number, string>): string {
    let res = '';
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.substring(i, i + 2), 16);
      if (cmap && cmap[code] !== undefined) {
        res += cmap[code];
      } else {
        res += String.fromCharCode(code);
      }
    }
    return res;
  }

  const pagesExtracted: ParsedPdfResult['pages'] = [];
  const allRows: ParsedPdfRow[] = [];
  let fullDocRawText = '';

  pageList.forEach((p, pIdx) => {
    const combinedStream = p.streamIds.map((sid) => decompressedStreams[sid] || '').join('\n');
    console.log(`[PDF] Page ${pIdx + 1}: combinedStream length=${combinedStream.length}, streamIds=${p.streamIds.join(',')}`);
    const items: PositionedTextItem[] = [];

    const btRegex = /BT([\s\S]*?)ET/g;
    let b: RegExpExecArray | null;
    let btCount = 0;

    while ((b = btRegex.exec(combinedStream)) !== null) {
      btCount++;
      const block = b[1];
      let currentFont = '';
      let currentX = 0;
      let currentY = 0;

      const cmdRegex =
        /(\/([A-Za-z0-9_]+)\s+[\d.]+\s+Tf)|((?:[-\d.]+\s+){6}Tm)|((?:[-\d.]+\s+){2}T[dm*D])|(T\*)|(\[(?:[\s\S]*?)\]\s*TJ)|(\((?:\\.|[^\\()])*\)\s*Tj)|(<[0-9a-fA-F\s]+>\s*Tj)/g;
      let match: RegExpExecArray | null;

      while ((match = cmdRegex.exec(block)) !== null) {
        if (match[1]) {
          currentFont = '/' + match[2];
        } else if (match[3]) {
          const tmParts = match[3].trim().split(/\s+/).map(Number);
          currentX = tmParts[4];
          currentY = tmParts[5];
        } else if (match[4]) {
          const tdParts = match[4].trim().split(/\s+/).map(Number);
          currentX += tdParts[0];
          currentY += tdParts[1];
        } else if (match[5]) {
          // T* (newline)
          currentY -= 12;
        } else if (match[6]) {
          const tjContent = match[6];
          const fontInfo = fontDicts[currentFont];
          const cmap = fontInfo?.cmap;
          const encoding = fontInfo?.encoding;

          let text = '';
          const tokenRegex = /\(((?:\\.|[^\\()])*)\)|<([0-9a-fA-F\s]+)>|([-\d.]+)/g;
          let tok: RegExpExecArray | null;
          while ((tok = tokenRegex.exec(tjContent)) !== null) {
            if (tok[1] !== undefined) {
              text += decodePdfString(tok[1], cmap, encoding);
            } else if (tok[2] !== undefined) {
              text += decodeHex(tok[2].replace(/\s+/g, ''), cmap);
            } else if (tok[3] !== undefined) {
              const kerning = parseFloat(tok[3]);
              if (kerning < -200) text += ' ';
            }
          }
          if (text.trim()) {
            items.push({
              text: text.trim(),
              x: currentX,
              y: currentY,
              font: currentFont,
              page: pIdx + 1,
            });
          }
        } else if (match[7]) {
          const raw = match[7].slice(1, match[7].lastIndexOf(')')).replace(/\\([\\()])/g, '$1');
          const fontInfo = fontDicts[currentFont];
          const text = decodePdfString(raw, fontInfo?.cmap, fontInfo?.encoding);
          if (text.trim()) {
            items.push({
              text: text.trim(),
              x: currentX,
              y: currentY,
              font: currentFont,
              page: pIdx + 1,
            });
          }
        } else if (match[8]) {
          const hex = match[8].replace(/[<>\s]/g, '');
          const fontInfo = fontDicts[currentFont];
          const text = decodeHex(hex, fontInfo?.cmap);
          if (text.trim()) {
            items.push({
              text: text.trim(),
              x: currentX,
              y: currentY,
              font: currentFont,
              page: pIdx + 1,
            });
          }
        }
      }
    }
    console.log(`[PDF] Page ${pIdx + 1}: BT blocks=${btCount}, items extracted=${items.length}`);

    if (items.length > 0) {
      // Determine if coordinate system is standard PDF (Y=0 at bottom) or Quartz inverted (Y=0 at top)
      // Check if top-of-page keywords (DATE, Generated, Statement, Klarr, Bank) have higher Y than footer items (Page, Generated by)
      let isYInverted = false;
      const headerItem = items.find((it) => /generated|statement|date|klarr|bank/i.test(it.text));
      const footerItem = items.find((it) => /page\s+\d+|generated\s+by/i.test(it.text));
      if (headerItem && footerItem) {
        // If header Y is less than footer Y, Y increases downwards (flipped)
        isYInverted = headerItem.y < footerItem.y;
      }
      console.log(`[PDF] Page ${pIdx + 1}: isYInverted=${isYInverted} headerY=${headerItem?.y} footerY=${footerItem?.y}`);

      // Sort items vertically (top to bottom) and horizontally (left to right)
      items.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 4) {
          return isYInverted ? a.y - b.y : b.y - a.y;
        }
        return a.x - b.x;
      });

      // Group items into spatial visual rows
      const rows: ParsedPdfRow[] = [];
      let currentRow: PositionedTextItem[] = [];
      let lastY: number | null = null;
      for (const item of items) {
        if (lastY === null || Math.abs(item.y - lastY) <= 4) {
          currentRow.push(item);
          lastY = item.y;
        } else {
          rows.push({ y: lastY, page: pIdx + 1, items: currentRow });
          currentRow = [item];
          lastY = item.y;
        }
      }
      if (currentRow.length > 0 && lastY !== null) {
        rows.push({ y: lastY, page: pIdx + 1, items: currentRow });
      }

      console.log(`[PDF] Page ${pIdx + 1}: rows=${rows.length} — first 3 rows: ${rows.slice(0, 3).map(r => r.items.map(i => i.text).join('|')).join(' // ')}`);

      pagesExtracted.push({ pageNum: pIdx + 1, rows, items });
      allRows.push(...rows);

      rows.forEach((r) => {
        fullDocRawText += r.items.map((it) => it.text).join(' ') + '\n';
      });
    } else {
      console.warn(`[PDF] Page ${pIdx + 1}: NO items extracted! combinedStream preview: ${combinedStream.substring(0, 200)}`);
    }
  });

  console.log('[PDF] DONE — totalRows:', allRows.length, 'rawText length:', fullDocRawText.length);
  return {
    pages: pagesExtracted,
    allRows,
    rawText: fullDocRawText,
  };
}
