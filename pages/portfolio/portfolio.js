// pages/portfolio/portfolio.js 作品集列表
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    categories: ['人像', '风光', '活动短片'],
    currentCat: '',
    portfolios: [],
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad: function () {
    const theme = themeUtil.getTheme();
    this.setData({
      theme: theme,
      pageStyle: themeUtil.getPageStyle(theme)
    });
    this.loadPortfolios();
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
  },

  onPullDownRefresh: function () {
    this.setData({ page: 1, portfolios: [], hasMore: true });
    this.loadPortfolios().then(() => wx.stopPullDownRefresh());
  },

  switchCat: function (e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ currentCat: cat, page: 1, portfolios: [], hasMore: true });
    this.loadPortfolios();
  },

  loadPortfolios: function () {
    const that = this;
    return wx.cloud.callFunction({
      name: 'content',
      data: {
        action: 'getPortfolios',
        category: that.data.currentCat || undefined,
        page: that.data.page,
        pageSize: that.data.pageSize
      }
    }).then(res => {
      let list = [];
      if (res.result && res.result.code === 0) {
        list = res.result.data.list || [];
      }
      if (!list.length && that.data.page === 1) {
        list = that.getMockPortfolios();
      }
      that.setData({
        portfolios: that.data.portfolios.concat(list),
        hasMore: list.length >= that.data.pageSize
      });
    }).catch(() => {
      if (that.data.page === 1) {
        that.setData({ portfolios: that.getMockPortfolios(), hasMore: false });
      }
    });
  },

  loadMore: function () {
    if (!this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadPortfolios();
  },

  goDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/portfolio-detail/portfolio-detail?id=' + id });
  },

  getMockPortfolios: function () {
    return [
      { _id: 'pf1', title: '柔光人像集', category: '人像', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('soft portrait collection warm light') + '&image_size=landscape_4_3', works_count: 12 },
      { _id: 'pf2', title: '山川湖海', category: '风光', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('mountain lake landscape mist') + '&image_size=landscape_4_3', works_count: 8 },
      { _id: 'pf3', title: '活动纪实', category: '活动短片', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('event documentary cinematic') + '&image_size=landscape_4_3', works_count: 6 }
    ];
  }
});
