import { corsHeaders, handleCors } from './middleware/cors.js';
import { register, login, refreshToken, logout } from './routes/auth.js';
import { getMe, deleteAccount } from './routes/users.js';
import { getLogs, createOrUpdateLog, deleteLog } from './routes/logs.js';
import { getStats } from './routes/stats.js';
import { err, ok } from './utils/response.js';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    const corsRes = handleCors(request);
    if (corsRes) return addCors(corsRes);

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    let response;

    try {
      // Auth routes
      if (path === '/auth/register' && method === 'POST')  response = await register(request, env);
      else if (path === '/auth/login' && method === 'POST') response = await login(request, env);
      else if (path === '/auth/refresh' && method === 'POST') response = await refreshToken(request, env);
      else if (path === '/auth/logout' && method === 'POST') response = await logout(request, env);

      // User routes
      else if (path === '/me' && method === 'GET')          response = await getMe(request, env);
      else if (path === '/me' && method === 'DELETE')        response = await deleteAccount(request, env);

      // Log routes
      else if (path === '/logs' && method === 'GET')         response = await getLogs(request, env);
      else if (path === '/logs' && method === 'POST')        response = await createOrUpdateLog(request, env);
      else if (path.startsWith('/logs/') && method === 'DELETE') {
        const log_date = path.split('/logs/')[1];
        response = await deleteLog(request, env, log_date);
      }

      // Stats
      else if (path === '/stats' && method === 'GET')        response = await getStats(request, env);

      else if (path === '/' && method === 'GET') response = ok({ message: 'Welcome to the Fap Tracker API!' });

      else response = err('Not found', 404);
    } catch (e) {
      console.error(e);
      response = err('Internal server error', 500);
    }

    return addCors(response);
  }
};

function addCors(response) {
  const res = new Response(response.body, response);
  Object.entries(corsHeaders()).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}