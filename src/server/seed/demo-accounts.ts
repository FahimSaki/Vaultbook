// Public on purpose: these are the demo logins, shown on the login page when DEMO=1.
export const DEMO_ACCOUNTS = {
  owner: {
    name: "Demo Owner",
    email: "owner@demo.example",
    password: "owner-demo-pass",
  },
  staff: {
    name: "Demo Staff",
    email: "staff@demo.example",
    password: "staff-demo-pass",
  },
} as const;
