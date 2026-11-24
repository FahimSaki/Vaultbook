"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImageGallery({
  productId,
  ids,
}: {
  productId: string;
  ids: string[];
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files) return;
    setErr("");
    setBusy(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await fetch(`/api/products/${productId}/images`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        setErr(
          ((await r.json().catch(() => null)) as { error?: string } | null)
            ?.error ?? "Upload failed",
        );
        break;
      }
    }
    setBusy(false);
    router.refresh();
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this photo?")) return;
    await fetch("/api/images/" + id, { method: "DELETE" });
    router.refresh();
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {ids.map((id) => (
          <div key={id} className="relative">
            <a href={`/api/images/${id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/images/${id}?size=thumb`}
                alt=""
                loading="lazy"
                width={128}
                height={128}
                className="size-32 rounded-lg object-cover"
              />
            </a>
            <button
              type="button"
              onClick={() => remove(id)}
              className="absolute right-1 top-1 rounded bg-background/80 px-1.5 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {busy ? (
        <p className="text-sm text-muted-foreground">Uploading…</p>
      ) : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  );
}
