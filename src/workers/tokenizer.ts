/**
 * Streaming tokenizer for the 4-level nested scan file:
 *   { groups: { <g>: { repos: { <r>: { images: { <v>: { ...image } } } } } } }
 *
 * A string-aware brace-depth scanner that emits each complete *image* object
 * (as raw JSON text) the moment its closing brace arrives. The full tree is
 * never resident; peak memory is one image object (~1.3MB max, measured).
 *
 * Why not stream-json: Phase 0 found the file is truncated mid-record.
 * stream-json's parser throws on abrupt EOF and its per-group emission would
 * discard the entire trailing group. Emitting per-image bounds the loss to the
 * single partial record, quantified in diagnostics. Zero dependencies is a
 * side benefit. (Brief §6.1 sanctions this as the fallback strategy.)
 *
 * Isomorphic: no DOM/worker/Node APIs — runs in the worker and in the Node
 * measurement harness against identical code.
 */

export interface ImageEvent {
  group: string;
  repo: string;
  /** key under `images` — the version string */
  imageKey: string;
  /** raw JSON slice of the image object, ready for JSON.parse */
  raw: string;
}

export interface TokenizerResult {
  truncated: boolean;
  unparsedTailBytes: number;
  partialTailPath: string | null;
  groupCount: number;
  repoCount: number;
}

interface Tokenizer {
  push(chunk: string): void;
  /** Call once after the last chunk. */
  finish(): TokenizerResult;
}

// Depth convention (count of open {/[): root object -> 1, `groups` value -> 2,
// group object -> 3, `repos` value -> 4, repo object -> 5, `images` value -> 6,
// image object -> 7.
const QUOTE = 34, BACKSLASH = 92, COLON = 58, COMMA = 44,
  LBRACE = 123, LBRACKET = 91, RBRACE = 125, RBRACKET = 93;

export function createImageTokenizer(onImage: (e: ImageEvent) => void): Tokenizer {
  const keyAtDepth: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let curStr = '';
  let pendingString: string | null = null;
  let capturing = false;
  let captureStart = -1;
  let curGroup = '', curRepo = '', curImage = '';
  let groupCount = 0;
  let repoCount = 0;
  let buf = '';
  let scanFrom = 0;
  let finished = false;

  const isImagePath = (): boolean =>
    keyAtDepth[1] === 'groups' && keyAtDepth[3] === 'repos' && keyAtDepth[5] === 'images';

  function scan(end: number): void {
    for (let i = scanFrom; i < end; i++) {
      const c = buf.charCodeAt(i);

      if (inString) {
        if (escaped) {
          escaped = false;
          if (!capturing) curStr += buf[i];
        } else if (c === BACKSLASH) {
          escaped = true;
          if (!capturing) curStr += buf[i];
        } else if (c === QUOTE) {
          inString = false;
          if (!capturing) {
            pendingString = curStr;
            curStr = '';
          }
        } else if (!capturing) {
          curStr += buf[i];
        }
        continue;
      }

      switch (c) {
        case QUOTE:
          inString = true;
          if (!capturing) curStr = '';
          break;
        case COLON:
          if (!capturing && pendingString !== null) {
            keyAtDepth[depth] = pendingString;
            pendingString = null;
          }
          break;
        case LBRACE:
        case LBRACKET:
          if (!capturing) pendingString = null;
          depth++;
          if (!capturing && c === LBRACE) {
            if (depth === 7 && isImagePath()) {
              capturing = true;
              captureStart = i;
              curGroup = keyAtDepth[2] ?? '';
              curRepo = keyAtDepth[4] ?? '';
              curImage = keyAtDepth[6] ?? '';
            } else if (depth === 3 && keyAtDepth[1] === 'groups') {
              groupCount++;
            } else if (depth === 5 && keyAtDepth[1] === 'groups' && keyAtDepth[3] === 'repos') {
              repoCount++;
            }
          }
          break;
        case RBRACE:
        case RBRACKET:
          depth--;
          if (capturing && depth === 6) {
            onImage({ group: curGroup, repo: curRepo, imageKey: curImage, raw: buf.slice(captureStart, i + 1) });
            capturing = false;
            captureStart = -1;
          }
          if (!capturing) pendingString = null;
          break;
        case COMMA:
          if (!capturing) pendingString = null;
          break;
        default:
          break;
      }
    }
    scanFrom = end;
  }

  return {
    push(chunk: string): void {
      if (finished) throw new Error('tokenizer already finished');
      buf += chunk;
      scan(buf.length);
      // Trim processed text so the buffer never grows beyond one in-flight image.
      if (capturing) {
        buf = buf.slice(captureStart);
        captureStart = 0;
        scanFrom = buf.length;
      } else {
        buf = '';
        scanFrom = 0;
      }
    },
    finish(): TokenizerResult {
      finished = true;
      const truncated = depth !== 0 || capturing || inString;
      return {
        truncated,
        unparsedTailBytes: capturing ? buf.length : 0,
        partialTailPath: capturing ? `${curGroup}/${curRepo}/${curImage}` : null,
        groupCount,
        repoCount,
      };
    },
  };
}
