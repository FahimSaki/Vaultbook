export class UserError extends Error {} // safe to show to the user
export class Forbidden extends Error {}
export class Locked extends Error {} // portable vault is locked
