// pages/admin/admin.js 管理员后台（多Tab）
const themeUtil = require('../../utils/theme.js');
const app = getApp();

Page({
  data: {
    theme: null,
    pageStyle: '',
    tabs: [
      { key: 'schedule', name: '档期日历' },
      { key: 'package', name: '套餐' },
      { key: 'work', name: '作品' },
      { key: 'equipment', name: '器材' },
      { key: 'pose', name: '美姿' },
      { key: 'order', name: '订单' }
    ],
    activeTab: 'schedule',
    // 日历
    weeks: ['日', '一', '二', '三', '四', '五', '六'],
    calYear: 0,
    calMonth: 0,
    calDays: [],
    // 各列表
    packageList: [],
    workList: [],
    equipmentList: [],
    poseList: [],
    orderList: [],
    // 字典
    statusMap: {
      pending_payment: '待支付', paid: '已支付', in_progress: '进行中',
      completed: '已完成', cancelled: '已取消', refunded: '已退款'
    },
    typeMap: {
      photo_only: '拍摄预约', equipment_only: '器材租赁', combo: '拍摄+器材'
    },
    // 封锁/锁定弹窗
    showBlockModal: false,
    showLockModal: false,
    blockForm: { start_date: '', end_date: '', reason: '', scope: 'photo_only' },
    lockForm: { start_date: '', end_date: '', equip_ids: [], reason: '' },
    equipmentOptions: []
  },

  onLoad: function () {
    const theme = themeUtil.getTheme();
    const now = new Date();
    this.setData({
      theme,
      pageStyle: themeUtil.getPageStyle(theme),
      calYear: now.getFullYear(),
      calMonth: now.getMonth() + 1
    });
    // 管理员权限校验
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '无管理员权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.renderCalendar();
    this.loadTabData('schedule');
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
  },

  // ===== Tab 切换 =====
  switchTab: function (e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key });
    this.loadTabData(key);
  },

  loadTabData: function (key) {
    switch (key) {
      case 'schedule': this.loadSchedules(); break;
      case 'package': this.loadPackages(); break;
      case 'work': this.loadWorks(); break;
      case 'equipment': this.loadEquipment(); break;
      case 'pose': this.loadPoses(); break;
      case 'order': this.loadOrders(); break;
    }
  },

  // ===== 档期日历 =====
  renderCalendar: function () {
    const { calYear, calMonth } = this.data;
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();

    const days = [];
    // 前置空白
    for (let i = 0; i < firstDay; i++) days.push({ day: '', date: '', marks: [], today: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = calYear + '-' + calMonth + '-' + d;
      days.push({
        day: d,
        date: dateStr,
        marks: [],
        today: dateStr === todayStr
      });
    }
    this.setData({ calDays: days });
  },

  loadSchedules: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'schedule',
      data: { action: 'getMonthSchedules', year: this.data.calYear, month: this.data.calMonth }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.markCalendar(res.result.data.list || []);
      }
    }).catch(() => {
      // mock 档期
      that.markCalendar([
        { schedule_type: 'photo', date: that.data.calYear + '-' + that.data.calMonth + '-10' },
        { schedule_type: 'equipment', date: that.data.calYear + '-' + that.data.calMonth + '-15' }
      ]);
    });
  },

  markCalendar: function (schedules) {
    const days = this.data.calDays.map(d => {
      const marks = schedules
        .filter(s => {
          const sd = new Date(s.date);
          const sStr = sd.getFullYear() + '-' + (sd.getMonth() + 1) + '-' + sd.getDate();
          return sStr === d.date;
        })
        .map(s => ({ type: s.schedule_type }));
      return { ...d, marks };
    });
    this.setData({ calDays: days });
  },

  prevMonth: function () {
    let { calYear, calMonth } = this.data;
    calMonth--;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    this.setData({ calYear, calMonth });
    this.renderCalendar();
    this.loadSchedules();
  },

  nextMonth: function () {
    let { calYear, calMonth } = this.data;
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    this.setData({ calYear, calMonth });
    this.renderCalendar();
    this.loadSchedules();
  },

  addManualSchedule: function () {
    wx.showModal({
      title: '新增线下档期',
      editable: true,
      placeholderText: '请输入日期，如 2026-10-20',
      success: res => {
        if (!res.confirm || !res.content) return;
        wx.cloud.callFunction({
          name: 'schedule',
          data: {
            action: 'createManualSchedule',
            schedule_type: 'photo',
            date: res.content,
            customer_name: '线下预留',
            location: '',
            remark: '管理员手动添加'
          }
        }).then(r => {
          if (r.result && r.result.code === 0) {
            wx.showToast({ title: '已添加', icon: 'success' });
            this.loadSchedules();
          } else {
            wx.showToast({ title: r.result.msg || '添加失败', icon: 'none' });
          }
        }).catch(() => {
          wx.showToast({ title: '已添加（模拟）', icon: 'success' });
          this.loadSchedules();
        });
      }
    });
  },

  // ===== 摄影师封锁档期 =====
  addBlockSchedule: function () {
    this.setData({ showBlockModal: true });
  },

  onBlockStartChange: function (e) {
    this.setData({ 'blockForm.start_date': e.detail.value });
  },
  onBlockEndChange: function (e) {
    this.setData({ 'blockForm.end_date': e.detail.value });
  },
  onBlockReasonInput: function (e) {
    this.setData({ 'blockForm.reason': e.detail.value });
  },
  onBlockScopeChange: function (e) {
    this.setData({ 'blockForm.scope': e.detail.value });
  },

  saveBlock: function () {
    const f = this.data.blockForm;
    if (!f.start_date) { wx.showToast({ title: '请选择开始日期', icon: 'none' }); return; }
    const that = this;
    wx.cloud.callFunction({
      name: 'schedule',
      data: {
        action: 'createManualSchedule',
        schedule_type: 'block',
        date: f.start_date,
        end_date: f.end_date || f.start_date,
        block_reason: f.reason,
        block_scope: f.scope
      }
    }).then(r => {
      if (r.result && r.result.code === 0) {
        wx.showToast({ title: `已封锁${r.result.data.count}天`, icon: 'success' });
        that.setData({ showBlockModal: false, blockForm: { start_date: '', end_date: '', reason: '', scope: 'photo_only' } });
        that.loadSchedules();
      } else {
        wx.showToast({ title: r.result.msg || '操作失败', icon: 'none' });
      }
    }).catch(() => wx.showToast({ title: '网络异常', icon: 'none' }));
  },

  // ===== 器材锁定档期 =====
  addEquipLock: function () {
    const that = this;
    if (!this.data.equipmentOptions.length) {
      wx.cloud.callFunction({
        name: 'manage',
        data: { action: 'listEquipment', page: 1, pageSize: 100 }
      }).then(res => {
        if (res.result && res.result.code === 0) {
          that.setData({ equipmentOptions: res.result.data.list || [] });
        }
      });
    }
    this.setData({ showLockModal: true });
  },

  onLockStartChange: function (e) {
    this.setData({ 'lockForm.start_date': e.detail.value });
  },
  onLockEndChange: function (e) {
    this.setData({ 'lockForm.end_date': e.detail.value });
  },
  onLockReasonInput: function (e) {
    this.setData({ 'lockForm.reason': e.detail.value });
  },
  toggleEquip: function (e) {
    const id = e.currentTarget.dataset.id;
    const ids = this.data.lockForm.equip_ids.slice();
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
    this.setData({ 'lockForm.equip_ids': ids });
  },

  saveLock: function () {
    const f = this.data.lockForm;
    if (!f.start_date) { wx.showToast({ title: '请选择开始日期', icon: 'none' }); return; }
    if (!f.equip_ids.length) { wx.showToast({ title: '请选择器材', icon: 'none' }); return; }
    const that = this;
    wx.cloud.callFunction({
      name: 'schedule',
      data: {
        action: 'createManualSchedule',
        schedule_type: 'equip_lock',
        date: f.start_date,
        end_date: f.end_date || f.start_date,
        lock_equip_ids: f.equip_ids,
        lock_reason: f.reason
      }
    }).then(r => {
      if (r.result && r.result.code === 0) {
        wx.showToast({ title: `已锁定${r.result.data.count}天`, icon: 'success' });
        that.setData({ showLockModal: false, lockForm: { start_date: '', end_date: '', equip_ids: [], reason: '' } });
        that.loadSchedules();
      } else {
        wx.showToast({ title: r.result.msg || '操作失败', icon: 'none' });
      }
    }).catch(() => wx.showToast({ title: '网络异常', icon: 'none' }));
  },

  closeModal: function () {
    this.setData({ showBlockModal: false, showLockModal: false });
  },

  // ===== 套餐管理 =====
  loadPackages: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'manage',
      data: { action: 'listPackages', page: 1, pageSize: 50 }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.setData({ packageList: res.result.data.list || [] });
      }
    }).catch(() => that.setData({ packageList: that.getMockPackages() }));
  },

  addPackage: function () {
    wx.showToast({ title: '新增套餐功能开发中', icon: 'none' });
    // 实际应弹出表单或跳转编辑页，调用 manage.createPackage
  },

  editPackage: function (e) {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' });
  },

  deletePackage: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定吗？',
      success: res => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'manage',
          data: { action: 'deletePackage', _id: id }
        }).then(r => {
          if (r.result && r.result.code === 0) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadPackages();
          }
        }).catch(() => {
          wx.showToast({ title: '已删除（模拟）', icon: 'success' });
          this.loadPackages();
        });
      }
    });
  },

  // ===== 作品管理 =====
  loadWorks: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'manage',
      data: { action: 'listWorks', page: 1, pageSize: 50 }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.setData({ workList: res.result.data.list || [] });
      }
    }).catch(() => that.setData({ workList: that.getMockWorks() }));
  },

  addWork: function () {
    wx.showToast({ title: '新增作品功能开发中', icon: 'none' });
  },

  deleteWork: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该作品吗？',
      success: res => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'manage',
          data: { action: 'deleteWork', _id: id }
        }).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadWorks();
        }).catch(() => {
          wx.showToast({ title: '已删除（模拟）', icon: 'success' });
          this.loadWorks();
        });
      }
    });
  },

  // ===== 器材管理 =====
  loadEquipment: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'manage',
      data: { action: 'listEquipment', page: 1, pageSize: 50 }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.setData({ equipmentList: res.result.data.list || [] });
      }
    }).catch(() => that.setData({ equipmentList: that.getMockEquipments() }));
  },

  addEquipment: function () {
    wx.showToast({ title: '新增器材功能开发中', icon: 'none' });
  },

  editEquipment: function () {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' });
  },

  deleteEquipment: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该器材吗？',
      success: res => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'manage',
          data: { action: 'deleteEquipment', _id: id }
        }).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadEquipment();
        }).catch(() => {
          wx.showToast({ title: '已删除（模拟）', icon: 'success' });
          this.loadEquipment();
        });
      }
    });
  },

  // ===== 美姿管理 =====
  loadPoses: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'manage',
      data: { action: 'listPoseMaterials', page: 1, pageSize: 50 }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.setData({ poseList: res.result.data.list || [] });
      }
    }).catch(() => that.setData({ poseList: that.getMockPoses() }));
  },

  addPose: function () {
    wx.showToast({ title: '新增美姿功能开发中', icon: 'none' });
  },

  deletePose: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该素材吗？',
      success: res => {
        if (!res.confirm) return;
        wx.cloud.callFunction({
          name: 'manage',
          data: { action: 'deletePoseMaterial', _id: id }
        }).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadPoses();
        }).catch(() => {
          wx.showToast({ title: '已删除（模拟）', icon: 'success' });
          this.loadPoses();
        });
      }
    });
  },

  // ===== 订单管理 =====
  loadOrders: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'order',
      data: { action: 'listAllOrders', page: 1, pageSize: 50 }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.setData({ orderList: res.result.data.list || [] });
      }
    }).catch(() => that.setData({ orderList: that.getMockOrders() }));
  },

  viewOrder: function (e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  },

  updateOrderStatus: function (e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    wx.cloud.callFunction({
      name: 'order',
      data: { action: 'updateOrderStatus', order_id: id, order_status: status }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '状态已更新', icon: 'success' });
        this.loadOrders();
      }
    }).catch(() => {
      wx.showToast({ title: '已更新（模拟）', icon: 'success' });
      this.loadOrders();
    });
  },

  // ===== Mock 数据 =====
  getMockPackages: function () {
    return [
      { _id: 'p1', name: '柔光人像写真', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=portrait&image_size=square', price: 89900, duration: 2, status: 1 }
    ];
  },
  getMockWorks: function () {
    return [
      { _id: 'w1', type: 'image', file_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=portrait&image_size=square', title: '午后柔光', category: '人像' }
    ];
  },
  getMockEquipments: function () {
    return [
      { _id: 'e1', name: '索尼 A7M4', images: ['https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=camera&image_size=square'], daily_rent: 15000, deposit: 800000 }
    ];
  },
  getMockPoses: function () {
    return [
      { _id: 'm1', category: '站姿', image_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pose&image_size=square', tip: '肩膀下沉，下巴轻收' }
    ];
  },
  getMockOrders: function () {
    return [
      { _id: 'o1', order_no: 'GY20261006001', order_type: 'photo_only', order_status: 'paid', total_amount: 89900, contact_name: '小影', contact_phone: '13800138000' }
    ];
  }
});
