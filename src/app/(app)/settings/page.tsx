import { getCtx } from "@/server/auth/ctx";
import { ChangePasswordForm } from "@/components/SettingsForms";
import { buttonVariants } from "@/components/ui/button";

export default async function SettingsPage() {
  await getCtx();
  return (
    <div className="space-y-10">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="space-y-3">
        <h2 className="font-medium">Password and recovery code</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Changing your password creates a new recovery code. The old code stops
          working, so write the new one on paper and destroy the old paper.
          Older backup files still open with the old password and the old code.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Backup</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Downloads a sealed copy of your data. It is encrypted with your
          current password, so it is safe to store on another stick. Product
          photos are not included yet; copy the data/blobs folder for those.
        </p>
        <a
          href="/api/backup"
          download
          className={buttonVariants({ variant: "outline" })}
        >
          Download encrypted backup
        </a>
      </section>
    </div>
  );
}
