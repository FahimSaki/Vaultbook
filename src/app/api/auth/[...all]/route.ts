import { toNextJsHandler } from "better-auth/next-js";
import { isPortable } from "@/server/config";
import { getAuth } from "@/server/auth/auth";
import { signupAllowed } from "@/server/auth/hosted";

const nope = () => new Response("Not found", { status: 404 });

export const GET = (req: Request) =>
  isPortable ? nope() : toNextJsHandler(getAuth()).GET(req);

export const POST = async (req: Request) => {
  if (isPortable) return nope();
  if (
    new URL(req.url).pathname.includes("/sign-up") &&
    !(await signupAllowed())
  )
    return Response.json({ message: "Sign-up is closed." }, { status: 403 });
  return toNextJsHandler(getAuth()).POST(req);
};
