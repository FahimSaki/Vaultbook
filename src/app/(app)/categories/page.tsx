import { getCtx } from "@/server/auth/ctx";
import { listCategories } from "@/server/services/categories";
import { Button } from "@/components/ui/button";
import { addCategoryAction, deleteCategoryAction } from "./actions";

export default async function CategoriesPage() {
  const ctx = await getCtx();
  const rows = await listCategories(ctx);
  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold">Categories</h1>
      <form
        action={addCategoryAction}
        className="flex gap-2"
        autoComplete="off"
      >
        <input
          name="name"
          required
          maxLength={100}
          placeholder="New category"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit">Add</Button>
      </form>
      <ul className="divide-y">
        {rows.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between py-2 text-sm"
          >
            {c.name}
            <form action={deleteCategoryAction.bind(null, c.id)}>
              <Button type="submit" variant="ghost" size="sm">
                Delete
              </Button>
            </form>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="py-2 text-sm text-muted-foreground">
            No categories yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
