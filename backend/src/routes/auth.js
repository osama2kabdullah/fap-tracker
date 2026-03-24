import { hashPassword, verifyPassword } from '../utils/hash.js';
import { signJWT } from '../utils/jwt.js';
import { ok, err } from '../utils/response.js';

export async function register(request, env) {
  const { email, username, password } = await request.json();
  if (!email || !username || !password) return err('All fields required');
  if (password.length < 8) return err('Password must be at least 8 characters');

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ? OR username = ?'
  ).bind(email, username).first();
  if (existing) return err('Email or username already taken', 409);

  const password_hash = await hashPassword(password);
  const result = await env.DB.prepare(
    'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?) RETURNING id'
  ).bind(email, username, password_hash).first();

  // Create streak row
  await env.DB.prepare(
    'INSERT INTO streaks (user_id) VALUES (?)'
  ).bind(result.id).run();

  const token = await signJWT({ userId: result.id, email }, env.JWT_SECRET, 3600);
  const refreshToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(result.id, refreshToken, expiresAt).run();

  return ok({ token, refreshToken, user: { id: result.id, email, username } }, 201);
}

export async function login(request, env) {
  const { email, password } = await request.json();
  if (!email || !password) return err('Email and password required');

  console.log(env);

  const user = await env.DB.prepare(
    'SELECT id, email, username, password_hash FROM users WHERE email = ?'
  ).bind(email).first();
  if (!user) return err('Invalid credentials', 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return err('Invalid credentials', 401);

  const token = await signJWT({ userId: user.id, email: user.email }, env.JWT_SECRET, 3600);
  const refreshToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(user.id, refreshToken, expiresAt).run();

  return ok({ token, refreshToken, user: { id: user.id, email: user.email, username: user.username } });
}

export async function refreshToken(request, env) {
  const { refreshToken } = await request.json();
  if (!refreshToken) return err('Refresh token required');

  const stored = await env.DB.prepare(
    'SELECT rt.*, u.email FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token = ? AND rt.expires_at > datetime("now")'
  ).bind(refreshToken).first();
  if (!stored) return err('Invalid or expired refresh token', 401);

  // Rotate the refresh token
  await env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(refreshToken).run();
  const newRefresh = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(stored.user_id, newRefresh, expiresAt).run();

  const token = await signJWT({ userId: stored.user_id, email: stored.email }, env.JWT_SECRET, 3600);
  return ok({ token, refreshToken: newRefresh });
}

export async function logout(request, env) {
  const { refreshToken } = await request.json();
  if (refreshToken) {
    await env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(refreshToken).run();
  }
  return ok({ message: 'Logged out' });
}