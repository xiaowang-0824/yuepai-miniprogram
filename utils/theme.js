// utils/theme.js
// 主题工具：为各页面提供主题色注入

const app = getApp();

/**
 * 获取当前主题对象
 */
function getTheme() {
  return app.getTheme();
}

/**
 * 生成用于注入页面根 view 的内联 style 字符串
 * 将主题色作为 CSS 变量注入，页面内所有子元素可用 var(--primary) 等
 */
function getPageStyle(theme) {
  theme = theme || getTheme();
  return [
    `--primary:${theme.primary}`,
    `--secondary:${theme.secondary}`,
    `--background:${theme.background}`,
    `--text-primary:${theme.text_primary}`,
    `--text-secondary:${theme.text_secondary}`,
    `--accent:${theme.accent}`
  ].join(';');
}

/**
 * 获取全部主题列表（用于设置页展示）
 */
function getThemeList() {
  return Object.values(app.themes);
}

module.exports = {
  getTheme,
  getPageStyle,
  getThemeList
};
