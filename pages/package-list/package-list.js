// pages/package-list/package-list.js 套餐列表
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    currentType: '',
    packages: [],
    selectMode: false
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    // 预约页跳转过来的选择模式
    if (options && options.select_mode === '1') {
      this.setData({ selectMode: true });
      wx.setNavigationBarTitle({ title: '选择套餐' });
    }
    this.loadPackages();
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
  },

  onPullDownRefresh: function () {
    this.loadPackages().then(() => wx.stopPullDownRefresh());
  },

  switchType: function (e) {
    this.setData({ currentType: e.currentTarget.dataset.type });
    this.loadPackages();
  },

  loadPackages: function () {
    const that = this;
    return wx.cloud.callFunction({
      name: 'content',
      data: { action: 'getPackages', type: that.data.currentType || undefined, page: 1, pageSize: 20 }
    }).then(res => {
      let list = [];
      if (res.result && res.result.code === 0) list = res.result.data.list || [];
      if (!list.length) list = that.getMockPackages();
      list.forEach(p => { p.priceYuan = (p.price / 100).toFixed(0); });
      that.setData({ packages: list });
    }).catch(() => {
      that.setData({ packages: that.getMockPackages().map(p => ({ ...p, priceYuan: (p.price / 100).toFixed(0) })) });
    });
  },

  goDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    // 选择模式：回传给预约页
    if (this.data.selectMode) {
      const pkg = this.data.packages.find(p => p._id === id);
      if (pkg) {
        wx.setStorageSync('select_package', pkg);
        wx.navigateBack();
      }
      return;
    }
    wx.navigateTo({ url: '/pages/package-detail/package-detail?id=' + id });
  },

  getMockPackages: function () {
    return [
      { _id: 'p1', name: '柔光人像写真', type: 'photo', category: '人像', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('soft portrait warm light') + '&image_size=square', price: 89900, duration: 2, description: '温柔自然光，记录最自然的你，精修20张' },
      { _id: 'p2', name: '城市风光短片', type: 'video', category: '活动短片', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('city cinematic short film') + '&image_size=square', price: 159900, duration: 4, description: '电影感运镜，3分钟成片，含调色' },
      { _id: 'p3', name: '户外田园写真', type: 'photo', category: '人像', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('outdoor pastoral portrait') + '&image_size=square', price: 109900, duration: 3, description: '自然光外景，精修25张，含一套服装建议' },
      { _id: 'p4', name: '情侣写真', type: 'photo', category: '人像', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('couple romantic portrait') + '&image_size=square', price: 129900, duration: 3, description: '双人互动抓拍，精修30张' }
    ];
  }
});
