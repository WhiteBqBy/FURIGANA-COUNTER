export type Piece = { base: string; ruby?: string };

type Token = { surface_form: string; reading?: string };

// kuromoji.js 本体と辞書は CDN から読み込みます（自前ホストする場合は README を参照）。
const CDN = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2";

let tokenizerPromise: Promise<{ tokenize: (t: string) => Token[] }> | null = null;

declare global {
  interface Window {
    kuromoji?: {
      builder: (opt: { dicPath: string }) => {
        build: (cb: (err: unknown, tokenizer: { tokenize: (t: string) => Token[] }) => void) => void;
      };
    };
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script error")));
      if (window.kuromoji) resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.dataset['src'] = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("script error"));
    document.head.appendChild(el);
  });
}

export function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      await loadScript(`${CDN}/build/kuromoji.js`);
      const kuromoji = window.kuromoji;
      if (!kuromoji) throw new Error("kuromoji unavailable");
      return await new Promise<{ tokenize: (t: string) => Token[] }>((resolve, reject) => {
        kuromoji.builder({ dicPath: `${CDN}/dict` }).build((err, tokenizer) => {
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve(tokenizer);
        });
      });
    })();
    tokenizerPromise.catch(() => {
      tokenizerPromise = null;
    });
  }
  return tokenizerPromise;
}

const KANJI = /[\u4e00-\u9faf\u3400-\u4dbf々]/;

export function toHiragana(input: string) {
  return input.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
function toKatakana(input: string) {
  return input.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

/** Split a token into kanji cores (with reading) and plain kana/other runs. */
function splitToken(surface: string, readingKana: string): Piece[] {
  const runs: { text: string; kanji: boolean }[] = [];
  for (const ch of surface) {
    const kanji = KANJI.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else runs.push({ text: ch, kanji });
  }
  if (!runs.some((r) => r.kanji)) return [{ base: surface }];

  const pieces: Piece[] = [];
  let reading = readingKana;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (!run) continue;
    if (!run.kanji) {
      const kata = toKatakana(run.text);
      if (reading.startsWith(kata)) reading = reading.slice(kata.length);
      pieces.push({ base: run.text });
      continue;
    }
    const next = runs[i + 1];
    let readingForRun: string;
    if (next) {
      const nextKata = toKatakana(next.text);
      const idx = nextKata ? reading.indexOf(nextKata) : -1;
      if (idx >= 0) {
        readingForRun = reading.slice(0, idx);
        reading = reading.slice(idx);
      } else {
        readingForRun = reading;
        reading = "";
      }
    } else {
      readingForRun = reading;
      reading = "";
    }
    if (readingForRun) pieces.push({ base: run.text, ruby: toHiragana(readingForRun) });
    else pieces.push({ base: run.text });
  }
  return pieces;
}

export function analyze(text: string, tokenize: (t: string) => Token[]) {
  const pieces: Piece[] = [];

  // Keep line breaks intact: tokenize line by line.
  const lines = text.split("\n");

  lines.forEach((line, li) => {
    if (li > 0) pieces.push({ base: "\n" });
    if (!line) return;

    // 行全体を一度だけKuromojiで解析する。
    // 途中でremainingを切って再解析すると、
    // 「二人」の「人」など文脈依存の読みが変わるため。
    const tokens = tokenize(line);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;

      // 「一人」を人数表現として扱う。
      // 「一人前」のように後ろに「前」が続く場合は、
      // 「一人」単体とはみなさずKuromojiの読みをそのまま使う。
      
      // 人数表現の特殊な読み
      const personReadings: Record<string, string> = {
        "一人": "ひとり",
        "二人": "ふたり",
        "四人": "よにん",
        "一歩": "いっぽ",
      };

      // 「一人ひとり」は「ひとりひとり」として扱う
      if (token.surface_form === "一人ひとり") {
        pieces.push({
          base: "一人",
          ruby: "ひとり",
        });
        pieces.push({
          base: "ひとり",
        });
        continue;
      }

      // 特殊な読みを持つ表現を処理
      if (
        token.surface_form === "一" ||
        token.surface_form === "二" ||
        token.surface_form === "四"
      ) {
        const next = tokens[i + 1];

        if (next) {
          const word = `${token.surface_form}${next.surface_form}`;
          const ruby = personReadings[word];

          // 「一人前」「二人前」などは人数表現として扱わない
          if (
            ruby &&
            !(next.surface_form === "人" && tokens[i + 2]?.surface_form === "前")
          ) {
            pieces.push({
              base: word,
              ruby,
            });

            i++;
            continue;
          }
        }
      }

      const surface = token.surface_form;
      const reading =
        token.reading && token.reading !== "*" ? token.reading : "";

      if (!reading || !KANJI.test(surface)) {
        pieces.push({ base: surface });
      } else {
        pieces.push(...splitToken(surface, reading));
      }
    }
  });

  return mergePlain(pieces);
}

function mergePlain(pieces: Piece[]) {
  const out: Piece[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (!p.ruby && last && !last.ruby) last.base += p.base;
    else if (p.ruby) out.push({ base: p.base, ruby: p.ruby });
    else out.push({ base: p.base });
  }
  return out;
}

export function inlineText(pieces: Piece[]) {
  return pieces.map((p) => (p.ruby ? `${p.base}（${p.ruby}）` : p.base)).join("");
}

export function hiraganaText(pieces: Piece[]) {
  return pieces.map((p) => (p.ruby ? p.ruby : p.base)).join("");
}

export function rubyPlainText(pieces: Piece[]) {
  return pieces.map((p) => (p.ruby ? `${p.base}（${p.ruby}）` : p.base)).join("");
}

const PUNCT =
  /[、。，．,.・…‥！？!?：；:;「」『』（）()［］\[\]【】〈〉《》〔〕｛｝{}“”‘’"'〝〟゛゜〃※]/g;

export function counts(text: string) {
  const total = [...text].length;
  const noPunct = [...text.replace(PUNCT, "")].length;
  const noSpace = [...text.replace(/[ \u3000\t\r\n]/g, "")].length;
  const noBoth = [...text.replace(PUNCT, "").replace(/[ \u3000\t\r\n]/g, "")].length;
  return { total, noPunct, noSpace, noBoth };
}
