import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

function redirectTo(req, pathname) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (_) {
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Require JWT_SECRET to validate auth cookies
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail closed for protected routes
    if (pathname.startsWith("/admin")) return redirectTo(req, "/admin/login");
    if (pathname.startsWith("/student")) return redirectTo(req, "/student/login");
    return redirectTo(req, "/login");
  }

  // --- Admin protection ---
  if (pathname.startsWith("/admin")) {
    // Allow admin login page
    if (pathname === "/admin/login") return NextResponse.next();

    const token = req.cookies.get("admin_token")?.value;
    if (!token) return redirectTo(req, "/admin/login");

    const payload = await verifyJwt(token, secret);
    if (!payload?.id || !payload?.email) return redirectTo(req, "/admin/login");

    return NextResponse.next();
  }

  // --- Student protection ---
  if (pathname.startsWith("/student")) {
    // Allow student login page (briefing: except login)
    if (pathname === "/student/login") return NextResponse.next();

    const token = req.cookies.get("student_token")?.value;
    if (!token) return redirectTo(req, "/student/login");

    const payload = await verifyJwt(token, secret);
    if (!payload?.id) return redirectTo(req, "/student/login");

    return NextResponse.next();
  }

  // --- Parent/Dashboard protection ---
  if (pathname.startsWith("/parent") || pathname.startsWith("/dashboard")) {
    // Keep existing behavior: redirect to /login
    if (pathname === "/login") return NextResponse.next();

    const token = req.cookies.get("token")?.value;
    if (!token) return redirectTo(req, "/login");

    const payload = await verifyJwt(token, secret);
    if (!payload?.id) return redirectTo(req, "/login");

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/parent/:path*",
    "/student/:path*",
    "/admin/:path*",
  ],
};