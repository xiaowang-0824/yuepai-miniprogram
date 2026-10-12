// pages/my-orders/my-orders.js 我的订单
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    statusList: [
      { key: 'pending_payment', text: '待支付' },
      { key: 'paid', text: '已支付' },
      { key: 'completed', text: '已完成' },
      { key: 'cancelled', text: '已取消' }
    ],
    statusMap: {
      pending_payment: '待支付',
      paid: '已支付',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
      refunded: '已退款'
    },
    typeMap: {
      photo_only: '拍摄预约',
      equipment_only: '器材租赁',
      combo: '拍摄+器材'
    },
    currentStatus: '',
    orders: []
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
    this.loadOrders();
  },

  onPullDownRefresh: function () {
    this.loadOrders().then(() => wx.stopPullDownRefresh());
  },

  switchStatus: function (e) {
    this.setData({ currentStatus: e.currentTarget.dataset.status });
    this.loadOrders();
  },

  loadOrders: function () {
    const that = this;
    return wx.cloud.callFunction({
      name: 'order',
      data: {
        action: 'getMyOrders',
        status: that.data.currentStatus || undefined,
        page: 1,
        pageSize: 50
      }
    }).then(res => {
      let list = [];
      if (res.result && res.result.code === 0) list = res.result.data.list || [];
      if (!list.length) list = that.getMockOrders();
      list.forEach(o => {
        o.amountYuan = (o.total_amount / 100).toFixed(0);
        o.dateText = that.formatDate(o.shooting_date || o.create_time);
      });
      that.setData({ orders: list });
    }).catch(() => that.setData({ orders: that.getMockOrders().map(o => ({
      ...o,
      amountYuan: (o.total_amount / 100).toFixed(0),
      dateText: that.formatDate(o.shooting_date)
    })) }));
  },

  formatDate: function (d) {
    if (!d) return '';
    const date = new Date(d);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  },

  goDetail: function (e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  },

  goPay: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.cloud.callFunction({
      name: 'pay',
      data: { action: 'mockPay', order_id: id }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.loadOrders();
      }
    }).catch(() => {
      wx.showToast({ title: '支付成功（模拟）', icon: 'success' });
      this.loadOrders();
    });
  },

  cancelOrder: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要取消这个订单吗？',
      success: res => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'order',
          data: { action: 'cancelOrder', order_id: id, reason: '用户取消' }
        }).then(r => {
          if (r.result && r.result.code === 0) {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadOrders();
          }
        }).catch(() => {
          wx.showToast({ title: '已取消（模拟）', icon: 'success' });
          this.loadOrders();
        });
      }
    });
  },

  getMockOrders: function () {
    return [
      { _id: 'o1', order_no: 'GY20261006001', order_type: 'photo_only', order_status: 'paid', total_amount: 89900, shooting_date: '2026-10-10', create_time: '2026-10-06' },
      { _id: 'o2', order_no: 'GY20261005002', order_type: 'equipment_only', order_status: 'pending_payment', total_amount: 30000, shooting_date: '2026-10-08', create_time: '2026-10-05' }
    ];
  }
});
