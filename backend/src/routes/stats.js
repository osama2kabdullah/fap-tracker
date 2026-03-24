import { requireAuth } from '../middleware/auth.js';
import { ok } from '../utils/response.js';

export async function getStats(request, env) {
  const user = await requireAuth(request, env);
  if (user instanceof Response) return user;

  const streak = await env.DB.prepare(
    'SELECT * FROM streaks WHERE user_id = ?'
  ).bind(user.userId).first();

  const totals = await env.DB.prepare(
    `SELECT
      COUNT(*) as total_days,
      SUM(CASE WHEN result = 'negative' THEN 1 ELSE 0 END) as clean_days,
      SUM(CASE WHEN result = 'positive' THEN 1 ELSE 0 END) as relapse_days
    FROM daily_logs WHERE user_id = ?`
  ).bind(user.userId).first();

  return ok({ streak, totals });
}