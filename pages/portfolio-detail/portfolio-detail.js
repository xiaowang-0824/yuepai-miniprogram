// pages/portfolio-detail/portfolio-detail.js
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    portfolioId: '',
    portfolio: {},
    works: []
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    this.setData({
      theme,
      pageStyle: themeUtil.getPageStyle(theme),
      portfolioId: options.id || ''
    });
    this.loadDetail();
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
  },

  loadDetail: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'content',
      data: { action: 'getPortfolioDetail', portfolio_id: that.data.portfolioId }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.setData({
          portfolio: res.result.data.portfolio || {},
          works: res.result.data.works || []
        });
      } else {
        that.setMockData();
      }
    }).catch(() => {
      that.setMockData();
    });
  },

  setMockData: function () {
    const that = this;
    const mockPortfolio = { _id: 'pf1', title: '柔光人像集', description: '用最柔和的光线，记录最自然的你', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('soft portrait warm light') + '&image_size=landscape_16_9' };
    const mockWorks = [];
    for (let i = 0; i < 8; i++) {
      mockWorks.push({
        _id: 'w' + i,
        file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('portrait soft light ' + i) + '&image_size=portrait_4_3'
      });
    }
    that.setData({ portfolio: mockPortfolio, works: mockWorks });
  },

  goWorkDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/work-detail/work-detail?id=' + id });
  },

  goBooking: function () {
    wx.navigateTo({ url: '/pages/booking/booking?portfolio_id=' + this.data.portfolioId });
  }
});
