import { getCtx } from "@/server/auth/ctx";
import { CsvImport } from "@/components/CsvImport";
import { buttonVariants } from "@/components/ui/button";

export default async function ImportPage() {
  const ctx = await getCtx();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Import / export</h1>
      <section className="space-y-2">
        <h2 className="font-medium">Import products</h2>
        <p className="text-sm text-muted-foreground">
          Columns: sku, name, price (required); category, currency, stock,
          reorder_level
          {ctx.role === "owner" ? ", cost" : ""} (optional). Nothing is saved
          until the file has no errors.
        </p>
        <CsvImport />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Export</h2>
        <a
          href="/api/export"
          download
          className={buttonVariants({ variant: "outline" })}
        >
          Download CSV
        </a>
      </section>
    </div>
  );
}
