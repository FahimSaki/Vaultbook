"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { importCsvAction, previewCsvAction } from "@/app/(app)/import/actions";
import type { CsvPreview } from "@/server/services/csv";

const MAX_FILE_BYTES = 900_000; // stay under the 1 MB Server Action body limit

export function CsvImport() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  async function onFile(f: File | undefined) {
    setMsg("");
    setPreview(null);
    setText("");
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setPreview({
        count: 0,
        errors: [],
        error:
          "File too large (max about 0.9 MB). Split it into smaller files.",
      });
      return;
    }
    const t = await f.text();
    setText(t);
    start(async () => setPreview(await previewCsvAction(t)));
  }
  const clean =
    preview &&
    !preview.error &&
    preview.errors.length === 0 &&
    preview.count > 0;
  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {pending ? (
        <p className="text-sm text-muted-foreground">Working…</p>
      ) : null}
      {preview?.error ? (
        <p className="text-sm text-destructive">{preview.error}</p>
      ) : null}
      {preview && !preview.error ? (
        <div className="space-y-2 text-sm">
          <p>
            {preview.count} valid rows, {preview.errors.length} problems.
          </p>
          <ul className="max-h-60 overflow-auto text-destructive">
            {preview.errors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button
        disabled={!clean || pending}
        onClick={() =>
          start(async () => {
            const r = await importCsvAction(text);
            setMsg(r.error ?? `Imported ${r.count} products.`);
            if (!r.error) {
              setPreview(null);
              setText("");
            }
          })
        }
      >
        Import
      </Button>
      {msg ? <p className="text-sm">{msg}</p> : null}
    </div>
  );
}
