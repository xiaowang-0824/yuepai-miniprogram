// pages/settings/settings.js 主题设置
const themeUtil = require('../../utils/theme.js');
const app = getApp();

Page({
  data: {
    theme: null,
    pageStyle: '',
    themes: [],
    currentKey: ''
  },

  onLoad: function () {
    const theme = themeUtil.getTheme();
    this.setData({
      theme,
      pageStyle: themeUtil.getPageStyle(theme),
      themes: themeUtil.getThemeList(),
      currentKey: theme.theme_key
    });
  },

  selectTheme: function (e) {
    const key = e.currentTarget.dataset.key;
    const newTheme = app.switchTheme(key);
    this.setData({
      theme: newTheme,
      pageStyle: themeUtil.getPageStyle(newTheme),
      currentKey: key
    });
    wx.showToast({ title: '主题已切换', icon: 'success' });
  }
});
