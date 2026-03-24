import { requireAuth } from '../middleware/auth.js';
import { ok, err } from '../utils/response.js';

export async function getMe(request, env) {
  const user = await requireAuth(request, env);
  if (user instanceof Response) return user;

  const profile = await env.DB.prepare(
    'SELECT id, email, username, created_at FROM users WHERE id = ?'
  ).bind(user.userId).first();
  if (!profile) return err('User not found', 404);

  const streak = await env.DB.prepare(
    'SELECT current_streak, best_streak, last_log_date FROM streaks WHERE user_id = ?'
  ).bind(user.userId).first();

  return ok({ ...profile, streak: streak ?? { current_streak: 0, best_streak: 0 } });
}

export async function deleteAccount(request, env) {
  const user = await requireAuth(request, env);
  if (user instanceof Response) return user;
  // CASCADE handles all related rows
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.userId).run();
  return ok({ message: 'Account deleted' });
}