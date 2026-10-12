// pages/work-detail/work-detail.js 作品全屏预览
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    works: [],
    currentIndex: 0,
    currentWork: {},
    showInfo: true
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    this.setData({
      theme,
      pageStyle: themeUtil.getPageStyle(theme)
    });

    const workId = options.id || '';
    this.loadWorks(workId);
  },

  /**
   * 加载作品：先取当前作品详情，再取同作品集列表作为滑动上下文
   */
  loadWorks: function (workId) {
    const that = this;
    if (!workId) {
      const works = that.getMockWorks();
      that.setData({ works, currentIndex: 0, currentWork: works[0] });
      return;
    }

    // 1. 取当前作品详情
    wx.cloud.callFunction({
      name: 'content',
      data: { action: 'getWorkDetail', work_id: workId }
    }).then(detailRes => {
      const currentWork = (detailRes.result && detailRes.result.code === 0)
        ? detailRes.result.data.work
        : null;

      // 2. 取同作品集作品列表（用于左右滑动）
      const portfolioId = currentWork ? currentWork.portfolio_id : undefined;
      return wx.cloud.callFunction({
        name: 'content',
        data: { action: 'getWorks', portfolio_id: portfolioId, page: 1, pageSize: 50 }
      }).then(listRes => {
        let works = [];
        if (listRes.result && listRes.result.code === 0) {
          works = listRes.result.data.list || [];
        }
        // 若列表中没有当前作品，插入到开头
        if (currentWork && !works.find(w => w._id === workId)) {
          works.unshift(currentWork);
        }
        if (!works.length) works = that.getMockWorks();

        let idx = works.findIndex(w => w._id === workId);
        if (idx < 0) idx = 0;
        that.setData({ works, currentIndex: idx, currentWork: works[idx] || currentWork || {} });
      });
    }).catch(() => {
      const works = that.getMockWorks();
      let idx = works.findIndex(w => w._id === workId);
      if (idx < 0) idx = 0;
      that.setData({ works, currentIndex: idx, currentWork: works[idx] });
    });
  },

  onSwiperChange: function (e) {
    const idx = e.detail.current;
    this.setData({
      currentIndex: idx,
      currentWork: this.data.works[idx] || {}
    });
  },

  toggleInfo: function () {
    this.setData({ showInfo: !this.data.showInfo });
  },

  goBack: function () {
    wx.navigateBack();
  },

  getMockWorks: function () {
    return [
      { _id: 'w1', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('portrait soft light warm') + '&image_size=portrait_4_3', title: '午后柔光' },
      { _id: 'w2', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('portrait golden hour') + '&image_size=portrait_4_3', title: '金色时刻' },
      { _id: 'w3', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('minimal portrait') + '&image_size=portrait_4_3', title: '极简' }
    ];
  }
});
