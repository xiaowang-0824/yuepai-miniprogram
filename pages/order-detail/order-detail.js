// pages/order-detail/order-detail.js 订单详情
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    orderId: '',
    order: {},
    questionnaire: null,
    statusMap: {
      pending_payment: '待支付',
      paid: '已支付',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
      refunded: '已退款'
    },
    statusDesc: ''
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    this.setData({
      theme,
      pageStyle: themeUtil.getPageStyle(theme),
      orderId: options.id || ''
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
      name: 'order',
      data: { action: 'getOrderDetail', order_id: that.data.orderId }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const order = res.result.data.order || {};
        that.setData({
          order,
          questionnaire: res.result.data.questionnaire || null,
          statusDesc: that.getStatusDesc(order.order_status)
        });
      } else {
        that.setMockData();
      }
    }).catch(() => that.setMockData());
  },

  getStatusDesc: function (status) {
    const map = {
      pending_payment: '请在15分钟内完成支付，超时订单将自动取消',
      paid: '已收到款项，摄影师将尽快与您联系',
      in_progress: '拍摄进行中，期待美好瞬间',
      completed: '拍摄已完成，感谢您的信任',
      cancelled: '订单已取消，档期已释放',
      refunded: '已退款，请注意查收'
    };
    return map[status] || '';
  },

  setMockData: function () {
    const order = {
      _id: 'o1',
      order_no: 'GY20261006001',
      order_type: 'photo_only',
      order_status: 'paid',
      total_amount: 89900,
      pay_amount: 89900,
      package_snapshot: { name: '柔光人像写真', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=portrait&image_size=square', price: 89900 },
      equipment_items: [],
      shooting_date: '2026-10-10',
      shooting_location: '城市公园',
      contact_name: '小影',
      contact_phone: '13800138000',
      remark: '希望拍得温柔一些'
    };
    this.setData({
      order,
      questionnaire: {
        atmosphere: '温柔、日系',
        feeling: '自然放松',
        appearance_concerns: '',
        reference_images: [],
        message: '谢谢摄影师～'
      },
      statusDesc: this.getStatusDesc('paid')
    });
  },

  payOrder: function () {
    wx.cloud.callFunction({
      name: 'pay',
      data: { action: 'mockPay', order_id: this.data.orderId }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.loadDetail();
      }
    }).catch(() => {
      wx.showToast({ title: '支付成功（模拟）', icon: 'success' });
      this.loadDetail();
    });
  },

  cancelOrder: function () {
    wx.showModal({
      title: '提示',
      content: '确定取消订单吗？',
      success: res => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'order',
          data: { action: 'cancelOrder', order_id: this.data.orderId, reason: '用户取消' }
        }).then(r => {
          if (r.result && r.result.code === 0) {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadDetail();
          }
        }).catch(() => {
          wx.showToast({ title: '已取消（模拟）', icon: 'success' });
          this.loadDetail();
        });
      }
    });
  }
});
