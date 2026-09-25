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
 * Fast pure-JS Base64 to Uint8Array converter (zero native dependency)
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Strip whitespace/newlines
  const clean = base64.replace(/[\r\n\s]/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = clean.length * 0.75;
  if (clean[clean.length - 1] === '=') bufferLength--;
  if (clean[clean.length - 2] === '=') bufferLength--;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const encoded1 = lookup[clean.charCodeAt(i)];
    const encoded2 = lookup[clean.charCodeAt(i + 1)];
    const encoded3 = lookup[clean.charCodeAt(i + 2)];
    const encoded4 = lookup[clean.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (clean[i + 2] !== '=') {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (clean[i + 3] !== '=') {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
}

/**
 * Checks if a PDF is password protected / encrypted
 */
export function isPdfEncrypted(uint8Data: Uint8Array): boolean {
  let str = '';
  const scanLen = Math.min(uint8Data.length, 32768);
  for (let i = 0; i < scanLen; i++) {
    str += String.fromCharCode(uint8Data[i]);
  }
  return str.includes('/Encrypt') || str.includes('/Filter /Standard');
}

/**
 * Universal on-device PDF parser engine.
 * Parses PDF streams, resolves ToUnicode CMaps, tokenizes operators (BT, ET, Tf, Tm, Td, TJ, Tj),
 * and reconstructs spatial rows with exact character and currency mappings.
 */
export function parsePdfDocument(uint8Data: Uint8Array): ParsedPdfResult {
  // Convert binary to latin1 string for structure scanning
  let latin1Str = '';
  const len = uint8Data.length;
  for (let i = 0; i < len; i += 32768) {
    const end = Math.min(i + 32768, len);
    latin1Str += String.fromCharCode.apply(null, Array.from(uint8Data.subarray(i, end)));
  }

  // 1. Find all PDF objects: "X Y obj ... endobj"
  const objRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  const objects: Record<string, { body: string; fullObjText: string; index: number }> = {};
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(latin1Str)) !== null) {
    const objNum = m[1];
    const fullObjText = m[0];
    const body = m[3];
    objects[objNum] = { body, fullObjText, index: m.index };
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
      const lenMatch = body.match(/\/Length\s+(\d+)/);
      if (lenMatch) streamLen = parseInt(lenMatch[1], 10);

      let streamBytes: Uint8Array;
      if (streamLen !== null && streamStart + streamLen <= uint8Data.length) {
        streamBytes = uint8Data.subarray(streamStart, streamStart + streamLen);
      } else {
        const endStreamIdx = latin1Str.indexOf('endstream', streamStart);
        streamBytes = uint8Data.subarray(
          streamStart,
          endStreamIdx !== -1 ? endStreamIdx : uint8Data.length
        );
      }

      if (body.includes('/Filter') && (body.includes('/FlateDecode') || body.includes('/Fl'))) {
        try {
          const dec = fflate.unzlibSync(streamBytes);
          let decStr = '';
          for (let i = 0; i < dec.length; i += 32768) {
            decStr += String.fromCharCode.apply(
              null,
              Array.from(dec.subarray(i, Math.min(i + 32768, dec.length)))
            );
          }
          decompressedStreams[id] = decStr;
        } catch {
          try {
            const dec = fflate.inflateSync(streamBytes);
            let decStr = '';
            for (let i = 0; i < dec.length; i += 32768) {
              decStr += String.fromCharCode.apply(
                null,
                Array.from(dec.subarray(i, Math.min(i + 32768, dec.length)))
              );
            }
            decompressedStreams[id] = decStr;
          } catch {
            let decStr = '';
            for (let i = 0; i < streamBytes.length; i += 32768) {
              decStr += String.fromCharCode.apply(
                null,
                Array.from(streamBytes.subarray(i, Math.min(i + 32768, streamBytes.length)))
              );
            }
            decompressedStreams[id] = decStr;
          }
        }
      } else {
        let decStr = '';
        for (let i = 0; i < streamBytes.length; i += 32768) {
          decStr += String.fromCharCode.apply(
            null,
            Array.from(streamBytes.subarray(i, Math.min(i + 32768, streamBytes.length)))
          );
        }
        decompressedStreams[id] = decStr;
      }
    }
  }

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
      const bfcharBlocks = [...text.matchAll(/(\d+)\s+beginbfchar([\s\S]*?)endbfchar/g)];
      for (const b of bfcharBlocks) {
        for (const line of b[2].trim().split(/\r?\n/)) {
          const parts = line.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F\s]+)>/);
          if (parts) {
            const code = parseInt(parts[1], 16);
            const hex = parts[2].replace(/\s+/g, '');
            let uni = '';
            for (let i = 0; i < hex.length; i += 4) {
              uni += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
            }
            map[code] = uni;
          }
        }
      }

      // beginbfrange: <startHex> <endHex> <targetHex> or array
      const bfrangeBlocks = [...text.matchAll(/(\d+)\s+beginbfrange([\s\S]*?)endbfrange/g)];
      for (const b of bfrangeBlocks) {
        for (const line of b[2].trim().split(/\r?\n/)) {
          const parts = line.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
          if (parts) {
            const start = parseInt(parts[1], 16);
            const end = parseInt(parts[2], 16);
            let target = parseInt(parts[3], 16);
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

  // 4. Map Font Resources to their CMaps
  const fontDicts: Record<string, { cmap?: Record<number, string> }> = {};
  for (const id in objects) {
    const body = objects[id].body;
    if (body.includes('/Font <<') || body.includes('/Font<<')) {
      const fontBlock = body.match(/\/Font\s*<<([\s\S]*?)>>/);
      if (fontBlock) {
        const fontEntries = [...fontBlock[1].matchAll(/\/([A-Za-z0-9_]+)\s+(\d+)\s+(\d+)\s+R/g)];
        for (const fe of fontEntries) {
          const fName = '/' + fe[1];
          const fObjId = fe[2];
          const fObj = objects[fObjId]?.body || '';
          const toUniMatch = fObj.match(/\/ToUnicode\s+(\d+)\s+(\d+)\s+R/);
          const toUniId = toUniMatch ? toUniMatch[1] : null;
          fontDicts[fName] = {
            cmap: toUniId ? cmaps[toUniId] : undefined,
          };
        }
      }
    }
  }

  // 5. Find Pages & their Content Stream references
  const pageList: Array<{ pageObj: string; streamId: string }> = [];
  for (const id in objects) {
    const body = objects[id].body;
    if (
      (body.includes('/Type /Page') || body.includes('/Type/Page')) &&
      !body.includes('/Pages')
    ) {
      const contentsMatch = body.match(/\/Contents\s+(\d+)\s+(\d+)\s+R/);
      if (contentsMatch) {
        pageList.push({ pageObj: id, streamId: contentsMatch[1] });
      }
    }
  }

  // Helper string decoders
  function decodePdfString(str: string, cmap?: Record<number, string>): string {
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
      } else {
        res += unescaped[i];
      }
    }
    return res;
  }

  function decodeHex(hex: string, cmap?: Record<number, string>): string {
    let res = '';
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.substr(i, 2), 16);
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
    const stream = decompressedStreams[p.streamId] || '';
    const btMatches = [...stream.matchAll(/BT([\s\S]*?)ET/g)];
    const items: PositionedTextItem[] = [];

    for (const b of btMatches) {
      const block = b[1];
      let currentFont = '';
      let currentX = 0;
      let currentY = 0;

      const cmdRegex =
        /(\/([A-Za-z0-9_]+)\s+[\d.]+\s+Tf)|((?:[-\d.]+\s+){6}Tm)|((?:[-\d.]+\s+){2}T[dm*])|(\[(?:[\s\S]*?)\]\s*TJ)|(\((?:\\.|[^\\()])*\)\s*Tj)|(<[0-9a-fA-F\s]+>\s*Tj)/g;
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
          const tjContent = match[5];
          const cmap = fontDicts[currentFont]?.cmap;
          let text = '';
          const tokenRegex = /\(((?:\\.|[^\\()])*)\)|<([0-9a-fA-F\s]+)>|([-\d.]+)/g;
          let tok: RegExpExecArray | null;
          while ((tok = tokenRegex.exec(tjContent)) !== null) {
            if (tok[1] !== undefined) {
              text += decodePdfString(tok[1], cmap);
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
        } else if (match[6]) {
          const raw = match[6].slice(1, match[6].lastIndexOf(')')).replace(/\\([\\()])/g, '$1');
          const cmap = fontDicts[currentFont]?.cmap;
          const text = decodePdfString(raw, cmap);
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
          const hex = match[7].replace(/[<>\s]/g, '');
          const cmap = fontDicts[currentFont]?.cmap;
          const text = decodeHex(hex, cmap);
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

    // Sort items vertically (top to bottom) and horizontally (left to right)
    items.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 4) return a.y - b.y;
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

    pagesExtracted.push({ pageNum: pIdx + 1, rows, items });
    allRows.push(...rows);

    rows.forEach((r) => {
      fullDocRawText += r.items.map((it) => it.text).join(' ') + '\n';
    });
  });

  return {
    pages: pagesExtracted,
    allRows,
    rawText: fullDocRawText,
  };
}
