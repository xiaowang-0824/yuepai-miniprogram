// pages/package-detail/package-detail.js 套餐详情
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    pkgId: '',
    pkg: {},
    samples: []
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    this.setData({
      theme,
      pageStyle: themeUtil.getPageStyle(theme),
      pkgId: options.id || ''
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
      data: { action: 'getPackageDetail', package_id: that.data.pkgId }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const pkg = res.result.data.package || {};
        that.setData({ pkg: that.formatPkg(pkg), samples: that.buildSamples(pkg) });
      } else {
        that.setMockData();
      }
    }).catch(() => that.setMockData());
  },

  formatPkg: function (pkg) {
    if (pkg.price) pkg.priceYuan = (pkg.price / 100).toFixed(0);
    return pkg;
  },

  // 合并图片+视频样片
  buildSamples: function (pkg) {
    const samples = [];
    (pkg.sample_images || []).forEach(url => samples.push({ type: 'image', url }));
    (pkg.sample_videos || []).forEach(url => samples.push({ type: 'video', url }));
    return samples;
  },

  setMockData: function () {
    const pkg = {
      _id: 'p1',
      name: '柔光人像写真',
      type: 'photo',
      category: '人像',
      cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('soft portrait cover') + '&image_size=landscape_16_9',
      price: 89900,
      priceYuan: '899',
      duration: 2,
      description: '采用最柔和的自然光线，捕捉你最放松自然的状态。适合个人写真、证件照外的生活化记录。',
      included_items: ['精修20张', '原片全送', '2小时拍摄', '1套服装', '1个场景'],
      notice: '预约后需支付定金锁定档期；如需改期请提前48小时联系。',
      sample_images: [
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('soft portrait sample 1') + '&image_size=square',
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('soft portrait sample 2') + '&image_size=square'
      ],
      sample_videos: []
    };
    this.setData({ pkg, samples: this.buildSamples(pkg) });
  },

  previewImage: function (e) {
    const urls = this.data.samples.filter(s => s.type === 'image').map(s => s.url);
    wx.previewImage({ current: e.currentTarget.dataset.url, urls });
  },

  goBooking: function () {
    wx.navigateTo({ url: '/pages/booking/booking?package_id=' + this.data.pkgId });
  }
});
