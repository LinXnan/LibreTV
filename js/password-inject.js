import { sha256 } from './sha256.js';

/**
 * 密码注入共享函数——将明文密码哈希后替换 HTML 中的 {{PASSWORD}} 占位符
 * @param {string} html - 原始 HTML 字符串
 * @param {string} password - 明文密码（空字符串时替换为空）
 * @returns {Promise<string>} 注入后的 HTML
 */
export async function injectPassword(html, password) {
  if (!password) {
    return html.replace('{{PASSWORD}}', '');
  }
  const passwordHash = await sha256(password);
  return html.replace('{{PASSWORD}}', passwordHash);
}
