// pages/index/index.js 首页逻辑
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    banners: [],
    hotPackages: [],
    featuredWorks: []
  },

  onLoad: function () {
    // 注入主题
    const theme = themeUtil.getTheme();
    this.setData({
      theme: theme,
      pageStyle: themeUtil.getPageStyle(theme)
    });

    this.loadData();
  },

  onShow: function () {
    // 主题可能在设置页被切换，回来时刷新
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({
        theme: theme,
        pageStyle: themeUtil.getPageStyle(theme)
      });
    }
  },

  onPullDownRefresh: function () {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载首页数据（Banner、热门套餐、精选作品）
   * 云函数未部署时使用本地 mock 数据，保证页面可浏览
   */
  loadData: function () {
    const that = this;
    const promises = [];

    // 1. 热门套餐
    promises.push(
      wx.cloud.callFunction({
        name: 'content',
        data: { action: 'getPackages', page: 1, pageSize: 5 }
      }).then(res => {
        if (res.result && res.result.code === 0) {
          return res.result.data.list || [];
        }
        return [];
      }).catch(() => [])
    );

    // 2. 精选作品
    promises.push(
      wx.cloud.callFunction({
        name: 'content',
        data: { action: 'getWorks', page: 1, pageSize: 6 }
      }).then(res => {
        if (res.result && res.result.code === 0) {
          return res.result.data.list || [];
        }
        return [];
      }).catch(() => [])
    );

    return Promise.all(promises).then(results => {
      let packages = results[0];
      let works = results[1];

      // 云函数无数据时使用 mock，保证首屏有内容
      if (!packages.length) packages = that.getMockPackages();
      if (!works.length) works = that.getMockWorks();

      // 价格分转元
      packages.forEach(p => {
        p.priceYuan = (p.price / 100).toFixed(0);
      });

      // Banner 取前3个作品
      const banners = works.slice(0, 3).map(w => ({
        _id: w._id,
        cover: w.thumbnail_url || w.file_url,
        title: w.title || ''
      }));

      that.setData({
        banners: banners,
        hotPackages: packages,
        featuredWorks: works
      });
    });
  },

  // ===== Mock 数据（云函数未部署时降级） =====
  getMockPackages: function () {
    return [
      { _id: 'p1', name: '柔光人像写真', type: 'photo', category: '人像', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=soft%20portrait%20photography%20warm%20light&image_size=landscape_4_3', price: 89900, duration: 2 },
      { _id: 'p2', name: '城市风光短片', type: 'video', category: '活动短片', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=city%20landscape%20cinematic&image_size=landscape_4_3', price: 159900, duration: 4 },
      { _id: 'p3', name: '户外田园写真', type: 'photo', category: '人像', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=outdoor%20pastoral%20portrait%20natural&image_size=landscape_4_3', price: 109900, duration: 3 }
    ];
  },

  getMockWorks: function () {
    const prompt = encodeURIComponent('portrait photography soft light minimal');
    return [
      { _id: 'w1', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('portrait soft light warm') + '&image_size=portrait_4_3', title: '午后柔光', category: '人像' },
      { _id: 'w2', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('landscape mountain mist') + '&image_size=landscape_4_3', title: '山间晨雾', category: '风光' },
      { _id: 'w3', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('couple outdoor golden hour') + '&image_size=portrait_4_3', title: '金色时刻', category: '人像' },
      { _id: 'w4', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('street photography cinematic') + '&image_size=landscape_4_3', title: '街角光影', category: '活动短片' },
      { _id: 'w5', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('minimal portrait studio') + '&image_size=portrait_4_3', title: '极简棚拍', category: '人像' },
      { _id: 'w6', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('nature forest light') + '&image_size=landscape_4_3', title: '林间光斑', category: '风光' }
    ];
  },

  // ===== 页面跳转 =====
  goPackageList: function () {
    wx.navigateTo({ url: '/pages/package-list/package-list' });
  },

  goPackageDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/package-detail/package-detail?id=' + id });
  },

  goEquipmentList: function () {
    wx.switchTab({ url: '/pages/equipment-list/equipment-list' });
  },

  goPortfolio: function () {
    wx.switchTab({ url: '/pages/portfolio/portfolio' });
  },

  goPose: function () {
    wx.navigateTo({ url: '/pages/pose/pose' });
  },

  goWorkDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/work-detail/work-detail?id=' + id });
  }
});
