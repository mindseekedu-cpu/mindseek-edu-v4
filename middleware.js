import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const isDevelopment = process.env.NODE_ENV === "development";

function debugLog(...args) {
  if (isDevelopment) {
    console.log("[middleware]", ...args);
  }
}

function redirectTo(req, path) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  return NextResponse.redirect(url);
}

async function verifyJwt(token, secret) {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    debugLog("JWT verification failed:", error?.message || error);
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Require JWT_SECRET to validate auth cookies
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    debugLog("JWT_SECRET is missing for protected route:", pathname);

    // Fail closed for protected routes
    if (pathname.startsWith("/admin")) return redirectTo(req, "/admin/login");
    if (pathname.startsWith("/student")) return redirectTo(req, "/student/login");
    return redirectTo(req, "/login");
  }

  // --- Admin protection ---
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      debugLog("Allowing admin login route:", pathname);
      return NextResponse.next();
    }

    const token = req.cookies.get("admin_token")?.value;
    if (!token) {
      debugLog("Missing admin_token. Redirecting to /admin/login from:", pathname);
      return redirectTo(req, "/admin/login");
    }

    const payload = await verifyJwt(token, secret);
    if (!payload?.id || !payload?.email) {
      debugLog("Invalid admin token payload:", payload, "for path:", pathname);
      return redirectTo(req, "/admin/login");
    }

    return NextResponse.next();
  }

  // --- Student protection ---
  if (pathname.startsWith("/student")) {
    // Allow student login page (briefing: except login)
    if (pathname === "/student/login") {
      debugLog("Allowing student login route:", pathname);
      return NextResponse.next();
    }

    const token = req.cookies.get("student_token")?.value;
    if (!token) {
      debugLog("Missing student_token. Redirecting to /student/login from:", pathname);
      return redirectTo(req, "/student/login");
    }

    const payload = await verifyJwt(token, secret);
    if (!payload?.id) {
      debugLog("Invalid student token payload:", payload, "for path:", pathname);
      return redirectTo(req, "/student/login");
    }

    return NextResponse.next();
  }

  // --- Parent protection ---
  const token = req.cookies.get("token")?.value;
  if (!token) {
    debugLog("Missing parent token. Redirecting to /login from:", pathname);
    return redirectTo(req, "/login");
  }

  const payload = await verifyJwt(token, secret);
  if (!payload?.id) {
    debugLog("Invalid parent token payload:", payload, "for path:", pathname);
    return redirectTo(req, "/login");
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