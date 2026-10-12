// pages/profile/profile.js 我的
const themeUtil = require('../../utils/theme.js');
const app = getApp();

Page({
  data: {
    theme: null,
    pageStyle: '',
    userInfo: {},
    isAdmin: false
  },

  onLoad: function () {
    const theme = themeUtil.getTheme();
    this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
    // 同步全局用户信息
    this.setData({
      userInfo: app.globalData.userInfo || {},
      isAdmin: app.globalData.isAdmin
    });
  },

  login: function () {
    const that = this;
    if (app.globalData.userInfo) return;
    wx.getUserProfile({
      desc: '用于完善个人资料',
      success: function (res) {
        const userInfo = res.userInfo;
        wx.cloud.callFunction({
          name: 'user',
          data: { action: 'login', nickname: userInfo.nickName, avatar_url: userInfo.avatarUrl }
        }).then(r => {
          if (r.result && r.result.code === 0) {
            app.globalData.userInfo = r.result.data.user;
            app.globalData.isAdmin = r.result.data.is_admin;
            that.setData({
              userInfo: app.globalData.userInfo,
              isAdmin: app.globalData.isAdmin
            });
          }
        }).catch(() => {
          // 降级：本地保存
          app.globalData.userInfo = userInfo;
          that.setData({ userInfo });
        });
      }
    });
  },

  goOrders: function () {
    wx.navigateTo({ url: '/pages/my-orders/my-orders' });
  },

  goSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  goAdmin: function () {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  contactPhotographer: function () {
    wx.showModal({
      title: '联系摄影师',
      content: '微信号：guangyingjishi\n（添加时请备注"约拍"）',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
