// pages/equipment-list/equipment-list.js 器材列表
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    categories: ['相机', '镜头', '灯光', '配件'],
    currentCat: '',
    equipments: [],
    selectMode: false,
    rentDate: '',
    rentDays: 1,
    lockedIds: []
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    if (options && options.select_mode === '1') {
      this.setData({
        selectMode: true,
        rentDate: options.date || '',
        rentDays: parseInt(options.days) || 1
      });
      wx.setNavigationBarTitle({ title: '选择器材' });
    }
    this.loadEquipments().then(() => {
      if (this.data.selectMode && this.data.rentDate) this.loadLockedIds();
    });
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
  },

  onPullDownRefresh: function () {
    this.loadEquipments().then(() => wx.stopPullDownRefresh());
  },

  switchCat: function (e) {
    this.setData({ currentCat: e.currentTarget.dataset.cat });
    this.loadEquipments();
  },

  loadEquipments: function () {
    const that = this;
    return wx.cloud.callFunction({
      name: 'content',
      data: { action: 'getEquipment', category: that.data.currentCat || undefined, page: 1, pageSize: 50 }
    }).then(res => {
      let list = [];
      if (res.result && res.result.code === 0) list = res.result.data.list || [];
      if (!list.length) list = that.getMockEquipments();
      list.forEach(e => {
        e.dailyRentYuan = (e.daily_rent / 100).toFixed(0);
        e.depositYuan = (e.deposit / 100).toFixed(0);
      });
      that.setData({ equipments: list });
      // 标记锁定器材
      that.markLocked();
    }).catch(() => {
      that.setData({ equipments: that.getMockEquipments().map(e => ({
        ...e,
        dailyRentYuan: (e.daily_rent / 100).toFixed(0),
        depositYuan: (e.deposit / 100).toFixed(0)
      })) });
    });
  },

  // 查询所选日期区间被锁定的器材ID
  loadLockedIds: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'content',
      data: { action: 'getLockedEquipIds', date: this.data.rentDate, days: this.data.rentDays }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.setData({ lockedIds: res.result.data.locked_ids || [] });
        that.markLocked();
      }
    }).catch(() => {});
  },

  // 给器材列表打锁定标记
  markLocked: function () {
    const ids = this.data.lockedIds;
    const list = this.data.equipments.map(e => ({ ...e, is_locked: ids.indexOf(e._id) >= 0 }));
    this.setData({ equipments: list });
  },

  goDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    // 选择模式：追加到已选器材并返回预约页
    if (this.data.selectMode) {
      const eq = this.data.equipments.find(item => item._id === id);
      if (eq && eq.is_locked) {
        wx.showToast({ title: '该器材所选日期已锁定', icon: 'none' });
        return;
      }
      if (eq) {
        const selected = wx.getStorageSync('select_equipment') || [];
        if (!selected.find(s => s._id === id)) {
          selected.push(eq);
          wx.setStorageSync('select_equipment', selected);
        }
        wx.navigateBack();
      }
      return;
    }
    wx.navigateTo({ url: '/pages/equipment-detail/equipment-detail?id=' + id });
  },

  getMockEquipments: function () {
    return [
      { _id: 'e1', name: '索尼 A7M4 全画幅微单', category: '相机', brand: 'Sony', model: 'A7M4', images: ['https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('sony a7m4 camera product') + '&image_size=square'], daily_rent: 15000, deposit: 800000, description: '3300万像素全画幅，4K60p视频' },
      { _id: 'e2', name: '索尼 24-70mm F2.8 GM', category: '镜头', brand: 'Sony', model: 'FE 24-70mm F2.8 GM II', images: ['https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('sony 24-70mm lens product') + '&image_size=square'], daily_rent: 12000, deposit: 500000, description: '大三元标准变焦，恒定F2.8光圈' },
      { _id: 'e3', name: '神牛 AD100Pro 外拍灯', category: '灯光', brand: 'Godox', model: 'AD100Pro', images: ['https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('godox ad100pro flash') + '&image_size=square'], daily_rent: 6000, deposit: 150000, description: '100Ws功率，便携外拍' },
      { _id: 'e4', name: '大疆 RS3 稳定器', category: '配件', brand: 'DJI', model: 'RS 3', images: ['https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('dji rs3 gimbal') + '&image_size=square'], daily_rent: 8000, deposit: 200000, description: '3公斤负载，视频拍摄必备' }
    ];
  }
});
