import { requireAuth } from '../middleware/auth.js';
import { ok, err } from '../utils/response.js';

export async function getLogs(request, env) {
  const user = await requireAuth(request, env);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month'); // 1-12

  let query = 'SELECT * FROM daily_logs WHERE user_id = ?';
  const params = [user.userId];

  if (year && month) {
    const pad = String(month).padStart(2, '0');
    query += ` AND log_date LIKE '${year}-${pad}-%'`;
  } else if (year) {
    query += ` AND log_date LIKE '${year}-%'`;
  }

  query += ' ORDER BY log_date DESC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  return ok(results);
}

export async function createOrUpdateLog(request, env) {
  const user = await requireAuth(request, env);
  if (user instanceof Response) return user;

  const { log_date, result, duration_minutes, notes } = await request.json();
  if (!log_date || !result) return err('log_date and result are required');
  if (!['positive', 'negative'].includes(result)) return err('result must be "positive" or "negative"');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(log_date)) return err('log_date must be YYYY-MM-DD');

  // Upsert — insert or replace if same user+date
  const log = await env.DB.prepare(`
    INSERT INTO daily_logs (user_id, log_date, result, duration_minutes, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, log_date) DO UPDATE SET
      result = excluded.result,
      duration_minutes = excluded.duration_minutes,
      notes = excluded.notes,
      updated_at = datetime('now')
    RETURNING *
  `).bind(user.userId, log_date, result, duration_minutes ?? null, notes ?? null).first();

  // Update streak
  await updateStreak(user.userId, env);

  return ok(log, 201);
}

export async function deleteLog(request, env, log_date) {
  const user = await requireAuth(request, env);
  if (user instanceof Response) return user;

  await env.DB.prepare(
    'DELETE FROM daily_logs WHERE user_id = ? AND log_date = ?'
  ).bind(user.userId, log_date).run();

  await updateStreak(user.userId, env);
  return ok({ message: 'Log deleted' });
}

async function updateStreak(userId, env) {
  // Get all negative (clean) days ordered descending
  const { results } = await env.DB.prepare(
    `SELECT log_date, result FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC`
  ).bind(userId).all();

  let current = 0;
  let best = 0;
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < results.length; i++) {
    if (results[i].result === 'negative') {
      streak++;
    } else {
      break;
    }
  }
  current = streak;

  // Calculate best streak
  let tempStreak = 0;
  for (const log of results) {
    if (log.result === 'negative') { tempStreak++; best = Math.max(best, tempStreak); }
    else tempStreak = 0;
  }

  await env.DB.prepare(`
    INSERT INTO streaks (user_id, current_streak, best_streak, last_log_date, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      current_streak = excluded.current_streak,
      best_streak = excluded.best_streak,
      last_log_date = excluded.last_log_date,
      updated_at = excluded.updated_at
  `).bind(userId, current, best, results[0]?.log_date ?? null).run();
}