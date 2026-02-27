import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("id_token", "", { path: "/", maxAge: 0 });
  return res;
}