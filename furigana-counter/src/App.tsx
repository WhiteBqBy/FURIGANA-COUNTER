import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  analyze,
  counts,
  getTokenizer,
  hiraganaText,
  inlineText,
  rubyPlainText,
  type Piece,
} from "@/lib/furigana";

const SAMPLE =
  "私が御社を志望した理由は、学生時代に培った課題解決の経験を、より大きな舞台で活かしたいと考えたからです。";

type CountSet = ReturnType<typeof counts>;

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-lg bg-surface px-3 py-2">
      <span className="text-base text-muted-foreground">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
        {value}
        <span className="ml-0.5 text-sm font-normal text-muted-foreground">文字</span>
      </span>
    </div>
  );
}

function CountGrid({ data, note }: { data: CountSet; note: string }) {
  return (
    <div className="mt-4 border-t border-dashed border-border pt-4">
      <p className="mb-2 text-sm text-muted-foreground">{note}</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <CountRow label="総文字数" value={data.total} />
        <CountRow label="句読点除外" value={data.noPunct} />
        <CountRow label="空白・改行除外" value={data.noSpace} />
        <CountRow label="句読点・空白・改行除外" value={data.noBoth} />
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      className="shrink-0 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors active:bg-surface sm:hover:bg-surface"
      onClick={async () => {
        if (!text) {
          toast("コピーする文章がありません");
          return;
        }
        try {
          await navigator.clipboard.writeText(text);
          toast.success(`${label}をコピーしました`);
        } catch {
          toast.error("コピーできませんでした");
        }
      }}
    >
      コピー
    </button>
  );
}

function Card({
  index,
  title,
  hint,
  copyText,
  copyLabel,
  children,
  countData,
  countNote,
}: {
  index: string;
  title: string;
  hint: string;
  copyText: string;
  copyLabel: string;
  children: React.ReactNode;
  countData: CountSet;
  countNote: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent font-sans text-base font-bold text-accent-foreground">
            {index}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-wide text-foreground">{title}</h2>
            <p className="truncate text-sm text-muted-foreground">{hint}</p>
          </div>
        </div>
        <CopyButton text={copyText} label={copyLabel} />
      </header>
      <div className="mt-3.5 rounded-xl bg-surface px-3.5 py-3.5">{children}</div>
      <CountGrid data={countData} note={countNote} />
    </section>
  );
}

export default function App() {
  const [text, setText] = useState(SAMPLE);
  const [tokenize, setTokenize] = useState<
    ((t: string) => { surface_form: string; reading?: string }[]) | null
  >(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    getTokenizer()
      .then((t) => {
        if (!alive) return;
        setTokenize(() => t.tokenize.bind(t));
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, []);

  const pieces: Piece[] = useMemo(() => {
    if (!tokenize || !text) return text ? [{ base: text }] : [];
    try {
      console.log("入力:", text);
      console.log("解析結果:", JSON.stringify(tokenize(text), null, 2));
      return analyze(text, tokenize);
    } catch {
      return [{ base: text }];
    }
  }, [text, tokenize]);

  const original = text;
  const inline = useMemo(() => inlineText(pieces), [pieces]);
  const kana = useMemo(() => hiraganaText(pieces), [pieces]);
  const rubyCopy = useMemo(() => rubyPlainText(pieces), [pieces]);

  const originalCounts = useMemo(() => counts(original), [original]);
  const kanaCounts = useMemo(() => counts(kana), [kana]);

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:pt-12">
        <header className="mb-6">
          <p className="text-base font-semibold tracking-[0.2em] text-accent-foreground/80">
            FURIGANA COUNT
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            文字数カウント＋ふりがな変換
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            面接回答・スピーチ・原稿の下読みに。登録なし・完全無料で、3種類の表示と4種類の文字数を同時に確認できます。
          </p>
        </header>

        <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-base font-semibold text-foreground">⚠ 注意事項</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            ふりがなは自動変換のため、正しく変換されない場合があります。
            変換結果に誤りや不具合がある場合は、ひらがな・カタカナに置き換えるなどして、
            文字数を合わせるよう修正してください。
          </p>
        </div>
        
        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="truncate text-base font-bold tracking-wide text-foreground">文章を入力</h2>
            <button
              type="button"
              onClick={() => setText("")}
              className="shrink-0 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground active:bg-surface sm:hover:bg-surface"
            >
              クリア
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ここに日本語の文章を入力してください。"
            className="mt-3 min-h-[9.5rem] w-full resize-y rounded-xl border border-border bg-surface p-3.5 text-[1.02rem] leading-[1.9] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring sm:min-h-[12rem]"
          />
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            {status === "loading"
              ? "変換辞書を読み込み中です…"
              : status === "error"
                ? "辞書の読み込みに失敗しました。ページを再読み込みしてください。"
                : "入力すると下に3種類の変換結果が表示されます。"}
          </p>
        </section>

        <div className="mt-4 space-y-4">
          <Card
            index="①"
            title="ルビ付き原文"
            hint="漢字の真上に（ふりがな）"
            copyText={rubyCopy}
            copyLabel="ルビ付き原文"
            countData={originalCounts}
            countNote="※ 追加されたふりがな・括弧は含めず、元の文章で計算"
          >
            <p className="whitespace-pre-wrap text-[1.05rem] leading-[3] tracking-[0.02em] text-foreground">
              {pieces.map((p, i) =>
                p.ruby ? (
                  <ruby key={i} className="ruby-block">
                    {p.base}
                    <rt>（{p.ruby}）</rt>
                  </ruby>
                ) : (
                  <span key={i}>{p.base}</span>
                ),
              )}
            </p>
          </Card>

          <Card
            index="②"
            title="横ふりがな文章"
            hint="漢字の直後に（ふりがな）"
            copyText={inline}
            copyLabel="横ふりがな文章"
            countData={originalCounts}
            countNote="※ 追加された（ふりがな）は含めず、元の文章で計算"
          >
            <p className="whitespace-pre-wrap text-[1.02rem] leading-[1.95] text-foreground">{inline}</p>
          </Card>

          <Card
            index="③"
            title="完全ひらがな"
            hint="読み方だけをひらがなに変換"
            copyText={kana}
            copyLabel="完全ひらがな"
            countData={kanaCounts}
            countNote="※ ひらがなに変換した文章そのもので計算"
          >
            <p className="whitespace-pre-wrap text-[1.02rem] leading-[1.95] text-foreground">{kana}</p>
          </Card>
        </div>

        <footer className="mt-8 text-center text-sm leading-relaxed text-muted-foreground">
          変換はすべてブラウザ内で処理され、文章は送信・保存されません。
          <br />
          固有名詞などは読みが正しくない場合があります。
        </footer>
      </div>
    </div>
  );
}
