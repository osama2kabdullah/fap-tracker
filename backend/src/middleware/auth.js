import { verifyJWT } from '../utils/jwt.js';
import { err } from '../utils/response.js';

export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return err('Missing token', 401);
  try {
    const payload = await verifyJWT(authHeader.slice(7), env.JWT_SECRET);
    return payload; // { userId, email }
  } catch (e) {
    return err('Invalid or expired token', 401);
  }
}