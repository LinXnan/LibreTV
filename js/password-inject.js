import { sha256 } from './sha256.js';

/**
 * 环境变量注入共享函数——将密码哈希替换 {{PASSWORD}}、TMDB key 替换 {{TMDB_API_KEY}}
 * @param {string} html - 原始 HTML 字符串
 * @param {string} password - 明文密码（空字符串时替换为空）
 * @param {string} tmdbApiKey - TMDB API key（空字符串时替换为空）
 * @returns {Promise<string>} 注入后的 HTML
 */
export async function injectPassword(html, password, tmdbApiKey = '') {
  let result = html;
  if (!password) {
    result = result.replace('{{PASSWORD}}', '');
  } else {
    const passwordHash = await sha256(password);
    result = result.replace('{{PASSWORD}}', passwordHash);
  }
  return result.replace('{{TMDB_API_KEY}}', tmdbApiKey || '');
}
