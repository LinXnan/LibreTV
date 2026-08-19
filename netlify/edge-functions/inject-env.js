import { injectPassword } from '../../js/password-inject.js';

// Netlify Edge Function to inject environment variables into HTML
export default async (request, context) => {
  const url = new URL(request.url);
  
  // Only process HTML pages
  const isHtmlPage = url.pathname.endsWith('.html') || url.pathname === '/';
  if (!isHtmlPage) {
    return; // Let the request pass through unchanged
  }

  const response = await context.next();
  
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const originalHtml = await response.text();
  const password = Netlify.env.get('PASSWORD') || '';
  const tmdbApiKey = Netlify.env.get('TMDB_API_KEY') || '';
  const modifiedHtml = await injectPassword(originalHtml, password, tmdbApiKey);

  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};

export const config = {
  path: ["/*"]
};