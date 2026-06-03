import { jwtVerify } from 'jose';
import supabase from './supabaseClient';

const DEFAULT_COOKIE_NAMES = [
  process.env.AUTH_COOKIE_NAME,
  'token',
  'authToken',
  'accessToken',
  'parentToken',
  'sessionToken',
].filter(Boolean);

const DEFAULT_PARENT_TABLE = process.env.PARENT_TABLE || 'parent_profile';
const DEFAULT_PARENT_SELECT =
  'id, name, email, subscription_tier, subscription_expires_at';

function getJwtSecret() {
  const rawSecret =
    process.env.JWT_SECRET ||
    process.env.AUTH_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!rawSecret) {
    const error = new Error('JWT secret belum dikonfigurasi.');
    error.statusCode = 500;
    throw error;
  }

  return new TextEncoder().encode(rawSecret);
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function getTokenFromCookies(req, cookieNames = DEFAULT_COOKIE_NAMES) {
  const cookieHeader = req?.headers?.cookie || '';
  const cookies = parseCookies(cookieHeader);
  for (const name of cookieNames) {
    if (cookies[name]) return cookies[name];
  }
  return null;
}

function getTokenFromAuthorization(req) {
  const authorization = req?.headers?.authorization || '';
  if (!authorization.startsWith('Bearer ')) return null;
  return authorization.slice(7).trim() || null;
}

function resolveParentId(payload) {
  return (
    payload?.parent_id ||
    payload?.parentId ||
    payload?.userId ||
    payload?.sub ||
    payload?.id ||
    null
  );
}

async function verifyRequestToken(req, options = {}) {
  const cookieNames = Array.isArray(options.cookieNames) && options.cookieNames.length > 0
    ? options.cookieNames
    : DEFAULT_COOKIE_NAMES;

  const token = getTokenFromCookies(req, cookieNames) || getTokenFromAuthorization(req);
  if (!token) {
    const error = new Error('Token autentikasi tidak ditemukan.');
    error.statusCode = 401;
    throw error;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const parentId = resolveParentId(payload);
    if (!parentId) {
      const error = new Error('Token valid tetapi parent_id tidak ditemukan.');
      error.statusCode = 401;
      throw error;
    }
    return { token, payload, parentId };
  } catch (error) {
    if (error.statusCode) throw error;
    const authError = new Error('Token tidak valid atau sudah kedaluwarsa.');
    authError.statusCode = 401;
    throw authError;
  }
}

export async function getAuthenticatedParent(req, options = {}) {
  if (!supabase) {
    const error = new Error('Supabase client tidak tersedia.');
    error.statusCode = 500;
    throw error;
  }

  const { parentId, payload, token } = await verifyRequestToken(req, options);
  const parentTable = options.parentTable || DEFAULT_PARENT_TABLE;
  const parentSelect = options.parentSelect || DEFAULT_PARENT_SELECT;

  const { data: parent, error } = await supabase
    .from(parentTable)
    .select(parentSelect)
    .eq('id', parentId)
    .is('deleted_at', null)
    .single();

  if (error) {
    const authError = new Error(error.message || 'Gagal mengambil data parent.');
    authError.statusCode = 500;
    throw authError;
  }

  if (!parent) {
    const notFoundError = new Error('Data parent tidak ditemukan.');
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  return { parentId, parent, token, payload };
}

export async function requireParentAuth(req, res, options = {}) {
  try {
    const auth = await getAuthenticatedParent(req, options);
    return { ok: true, ...auth };
  } catch (error) {
    if (res && typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(error.statusCode || 401).json({
        success: false,
        message: error.message || 'Autentikasi gagal.',
      });
    }
    throw error;
  }
}

export { parseCookies, getTokenFromCookies, verifyRequestToken };
