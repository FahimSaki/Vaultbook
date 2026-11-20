export class UserError extends Error {}
export class Forbidden extends Error {}
export class Locked extends Error {}

export const pgCode = (e: unknown): string | undefined => {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code ?? x?.cause?.code;
};
