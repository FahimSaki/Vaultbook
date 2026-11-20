export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="mx-auto w-full max-w-sm p-6 pt-24">{children}</main>;
}
