// pages/equipment-detail/equipment-detail.js 器材详情
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    equipId: '',
    equip: {}
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    this.setData({
      theme,
      pageStyle: themeUtil.getPageStyle(theme),
      equipId: options.id || ''
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
      data: { action: 'getEquipmentDetail', equipment_id: that.data.equipId }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const equip = res.result.data.equipment || {};
        that.setData({ equip: that.formatEquip(equip) });
      } else {
        that.setMockData();
      }
    }).catch(() => that.setMockData());
  },

  formatEquip: function (equip) {
    equip.dailyRentYuan = (equip.daily_rent / 100).toFixed(0);
    equip.depositYuan = (equip.deposit / 100).toFixed(0);
    if (!equip.images) equip.images = [];
    return equip;
  },

  setMockData: function () {
    const equip = {
      _id: 'e1',
      name: '索尼 A7M4 全画幅微单',
      category: '相机',
      brand: 'Sony',
      model: 'A7M4',
      images: [
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('sony a7m4 front') + '&image_size=square',
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('sony a7m4 side') + '&image_size=square'
      ],
      daily_rent: 15000,
      dailyRentYuan: '150',
      deposit: 800000,
      depositYuan: '8000',
      description: '3300万像素全画幅传感器，支持4K60p视频拍摄，10bit色深，S-Cinetone色彩，适合人像与视频创作。',
      care_notice: '本器材是个人自用设备，租金偏低，请用心呵护，人为损坏需要按维修价赔偿。'
    };
    this.setData({ equip });
  },

  // 单独租用器材
  goRentOnly: function () {
    wx.navigateTo({ url: '/pages/booking/booking?equipment_id=' + this.data.equipId });
  },

  // 加入拍摄预约（套餐+器材组合）
  goRentWithPhoto: function () {
    wx.navigateTo({ url: '/pages/booking/booking?equipment_id=' + this.data.equipId + '&allow_add_package=1' });
  }
});
