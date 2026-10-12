// pages/booking/booking.js 预约下单（核心）
// 职责：表单+草稿+问卷+档期校验+沙箱支付
const themeUtil = require('../../utils/theme.js');

const DRAFT_KEY = 'booking_draft';

Page({
  data: {
    theme: null,
    pageStyle: '',
    today: '',
    // 商品
    selectedPackage: {},
    selectedEquipmentList: [],
    // 表单
    form: {
      shooting_date: '',
      shooting_location: '',
      contact_name: '',
      contact_phone: '',
      remark: '',
      rent_days: 1
    },
    // 问卷
    showQuestionnaire: false,
    questionnaire: {
      atmosphere: '',
      feeling: '',
      appearance_concerns: '',
      reference_images: [],
      message: '',
      is_skipped: false
    },
    // 档期
    scheduleTip: '',
    scheduleAvailable: true,
    // 派生字段
    orderType: '',
    orderTypeText: '',
    hasEquipment: false,
    equipmentAmountYuan: '0',
    depositAmountYuan: '0',
    totalAmountYuan: '0',
    // 金额
    totalAmount: 0,
    submitting: false
  },

  onLoad: function (options) {
    const theme = themeUtil.getTheme();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme), today });

    // 根据来源加载默认商品
    this.loadDefaultProducts(options);
    // 加载草稿（若有）
    this.loadDraft();
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
    // 接收从列表页回传的选中商品
    this.pickProductsFromList();
  },

  // 从列表页选择回传的商品（套餐/器材）
  pickProductsFromList: function () {
    let changed = false;

    // 套餐（单选，覆盖）
    const pkg = wx.getStorageSync('select_package');
    if (pkg && pkg._id) {
      pkg.priceYuan = (pkg.price / 100).toFixed(0);
      this.setData({ selectedPackage: pkg });
      wx.removeStorageSync('select_package');
      changed = true;
    }

    // 器材（多选，追加去重）
    const pickedEquip = wx.getStorageSync('select_equipment') || [];
    if (pickedEquip.length) {
      const list = this.data.selectedEquipmentList.slice();
      pickedEquip.forEach(eq => {
        if (!list.find(e => e._id === eq._id)) {
          eq.rentDays = this.data.form.rent_days;
          eq.dailyRentYuan = (eq.daily_rent / 100).toFixed(0);
          list.push(eq);
        }
      });
      this.setData({ selectedEquipmentList: list });
      wx.removeStorageSync('select_equipment');
      changed = true;
    }

    if (changed) {
      this.calcAmount();
      // 若已选日期，重新校验档期
      if (this.data.form.shooting_date) {
        this.checkSchedule(this.data.form.shooting_date);
      }
      this.saveDraft();
    }
  },

  onUnload: function () {
    // 离开页面保存草稿
    this.saveDraft();
  },

  // ===== 商品加载 =====
  loadDefaultProducts: function (options) {
    const that = this;
    const packageId = options.package_id;
    const equipmentId = options.equipment_id;

    if (packageId) {
      wx.cloud.callFunction({
        name: 'content',
        data: { action: 'getPackageDetail', package_id: packageId }
      }).then(res => {
        if (res.result && res.result.code === 0) {
          const pkg = res.result.data.package || {};
          pkg.priceYuan = (pkg.price / 100).toFixed(0);
          that.setData({ selectedPackage: pkg });
          that.calcAmount();
        } else {
          that.setMockPackage(packageId);
        }
      }).catch(() => that.setMockPackage(packageId));
    }

    if (equipmentId) {
      wx.cloud.callFunction({
        name: 'content',
        data: { action: 'getEquipmentDetail', equipment_id: equipmentId }
      }).then(res => {
        if (res.result && res.result.code === 0) {
          const eq = res.result.data.equipment || {};
          eq.dailyRentYuan = (eq.daily_rent / 100).toFixed(0);
          eq.rentDays = that.data.form.rent_days;
          that.setData({ selectedEquipmentList: [eq] });
          that.calcAmount();
        } else {
          that.setMockEquipment(equipmentId);
        }
      }).catch(() => that.setMockEquipment(equipmentId));
    }
  },

  setMockPackage: function (id) {
    const pkg = { _id: id, name: '柔光人像写真', cover_image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=portrait&image_size=square', price: 89900, priceYuan: '899' };
    this.setData({ selectedPackage: pkg });
    this.calcAmount();
  },

  setMockEquipment: function (id) {
    const eq = { _id: id, name: '索尼 A7M4', images: ['https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=camera&image_size=square'], daily_rent: 15000, dailyRentYuan: '150', rentDays: this.data.form.rent_days };
    this.setData({ selectedEquipmentList: [eq] });
    this.calcAmount();
  },

  // ===== 草稿 =====
  saveDraft: function () {
    const draft = {
      form: this.data.form,
      questionnaire: this.data.questionnaire,
      selectedPackage: this.data.selectedPackage,
      selectedEquipmentList: this.data.selectedEquipmentList,
      savedAt: Date.now()
    };
    try {
      wx.setStorageSync(DRAFT_KEY, draft);
    } catch (e) {}
  },

  loadDraft: function () {
    try {
      const draft = wx.getStorageSync(DRAFT_KEY);
      if (draft && draft.form) {
        // 若已有从URL传入的商品，不覆盖商品
        const hasPackage = !!this.data.selectedPackage._id;
        const hasEquip = this.data.selectedEquipmentList.length > 0;
        this.setData({
          form: draft.form,
          questionnaire: draft.questionnaire || this.data.questionnaire,
          selectedPackage: hasPackage ? this.data.selectedPackage : (draft.selectedPackage || {}),
          selectedEquipmentList: hasEquip ? this.data.selectedEquipmentList : (draft.selectedEquipmentList || [])
        });
        this.calcAmount();
      }
    } catch (e) {}
  },

  clearDraft: function () {
    try { wx.removeStorageSync(DRAFT_KEY); } catch (e) {}
  },

  // ===== 表单输入 =====
  onInput: function (e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
    this.saveDraft();
  },

  onQInput: function (e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`questionnaire.${field}`]: e.detail.value });
    this.saveDraft();
  },

  toggleQuestionnaire: function () {
    this.setData({ showQuestionnaire: !this.data.showQuestionnaire });
  },

  // 日期选择 + 档期校验
  onDateChange: function (e) {
    const date = e.detail.value;
    this.setData({ 'form.shooting_date': date });
    this.checkSchedule(date);
    this.saveDraft();
  },

  changeDays: function (e) {
    const delta = parseInt(e.currentTarget.dataset.delta);
    let days = this.data.form.rent_days + delta;
    if (days < 1) days = 1;
    this.setData({ 'form.rent_days': days });
    // 更新器材租期
    const list = this.data.selectedEquipmentList.map(eq => ({ ...eq, rentDays: days }));
    this.setData({ selectedEquipmentList: list });
    this.calcAmount();
    this.saveDraft();
  },

  // ===== 档期校验 =====
  checkSchedule: function (date) {
    const that = this;
    if (!date) return;
    const hasPackage = !!this.data.selectedPackage._id;
    const hasEquipment = this.data.selectedEquipmentList.length > 0;
    let type = 'equipment';
    if (hasPackage && hasEquipment) type = 'combo';
    else if (hasPackage) type = 'photo';

    const equipmentIds = this.data.selectedEquipmentList.map(e => e._id);

    wx.cloud.callFunction({
      name: 'booking',
      data: {
        action: 'checkSchedule',
        date, type,
        equipment_ids: equipmentIds,
        rent_days: this.data.form.rent_days
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const data = res.result.data;
        that.setData({
          scheduleAvailable: data.available,
          scheduleTip: data.available ? '这天档期空闲，可以预约～' : (data.conflict_reason || '这天已有安排，换个日子吧～')
        });
      }
    }).catch(() => {
      // 云函数未部署时默认允许
      that.setData({ scheduleAvailable: true, scheduleTip: '' });
    });
  },

  // ===== 商品增删 =====
  addPackage: function () {
    // 跳转到套餐列表选择（带回选）
    wx.navigateTo({ url: '/pages/package-list/package-list?select_mode=1' });
  },

  removePackage: function () {
    this.setData({ selectedPackage: {} });
    this.calcAmount();
    this.saveDraft();
  },

  addEquipment: function () {
    const date = this.data.form.shooting_date || '';
    const days = this.data.form.rent_days;
    wx.navigateTo({ url: `/pages/equipment-list/equipment-list?select_mode=1&date=${date}&days=${days}` });
  },

  removeEquipment: function (e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.selectedEquipmentList.filter(eq => eq._id !== id);
    this.setData({ selectedEquipmentList: list });
    this.calcAmount();
    this.saveDraft();
  },

  // ===== 金额计算 =====
  calcAmount: function () {
    const hasPackage = !!this.data.selectedPackage._id;
    const hasEquipment = this.data.selectedEquipmentList.length > 0;
    let orderType = 'combo';
    if (hasPackage && !hasEquipment) orderType = 'photo_only';
    if (!hasPackage && hasEquipment) orderType = 'equipment_only';
    const orderTypeText = { photo_only: '仅拍摄', equipment_only: '仅器材租赁', combo: '拍摄+器材' }[orderType] || '';

    let equipmentAmount = 0;
    let depositAmount = 0;
    this.data.selectedEquipmentList.forEach(eq => {
      const days = eq.rentDays || this.data.form.rent_days;
      equipmentAmount += (eq.daily_rent || 0) * days;
      depositAmount += eq.deposit || 0;
    });
    let total = (this.data.selectedPackage.price || 0) + equipmentAmount + depositAmount;

    this.setData({
      orderType,
      orderTypeText,
      hasEquipment,
      equipmentAmountYuan: (equipmentAmount / 100).toFixed(0),
      depositAmountYuan: (depositAmount / 100).toFixed(0),
      totalAmountYuan: (total / 100).toFixed(0),
      totalAmount: total
    });
  },

  // ===== 问卷参考图上传 =====
  uploadRefImage: function () {
    const that = this;
    wx.chooseMedia({
      count: 6 - this.data.questionnaire.reference_images.length,
      mediaType: ['image'],
      success: function (res) {
        const tempFiles = res.tempFiles.map(f => f.tempFilePath);
        // 上传到云存储
        const uploadPromises = tempFiles.map(path => {
          const cloudPath = 'questionnaire/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
          return wx.cloud.uploadFile({ cloudPath, filePath: path }).then(r => r.fileID);
        });
        Promise.all(uploadPromises).then(fileIDs => {
          that.setData({
            'questionnaire.reference_images': that.data.questionnaire.reference_images.concat(fileIDs)
          });
          that.saveDraft();
        }).catch(() => {
          // 云存储不可用时用本地路径降级
          that.setData({
            'questionnaire.reference_images': that.data.questionnaire.reference_images.concat(tempFiles)
          });
        });
      }
    });
  },

  // ===== 提交订单 =====
  submitOrder: function () {
    const that = this;
    if (this.data.submitting) return;

    // 基础校验
    if (!this.data.selectedPackage._id && this.data.selectedEquipmentList.length === 0) {
      wx.showToast({ title: '请选择套餐或器材', icon: 'none' });
      return;
    }
    if (!this.data.form.shooting_date) {
      wx.showToast({ title: '请选择拍摄日期', icon: 'none' });
      return;
    }
    if (!this.data.form.contact_name) {
      wx.showToast({ title: '请填写联系人', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(this.data.form.contact_phone)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    if (!this.data.scheduleAvailable) {
      wx.showToast({ title: '该日期档期不可用，请更换', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    // 构建订单参数
    const hasPackage = !!this.data.selectedPackage._id;
    const hasEquipment = this.data.selectedEquipmentList.length > 0;
    let orderType = 'combo';
    if (hasPackage && !hasEquipment) orderType = 'photo_only';
    if (!hasPackage && hasEquipment) orderType = 'equipment_only';

    const equipmentItems = this.data.selectedEquipmentList.map(eq => ({
      equipment_id: eq._id,
      snapshot: { name: eq.name, images: eq.images },
      daily_rent: eq.daily_rent,
      days: eq.rentDays || this.data.form.rent_days,
      subtotal: eq.daily_rent * (eq.rentDays || this.data.form.rent_days)
    }));

    // 问卷：若未展开或全空，标记为跳过
    const q = this.data.questionnaire;
    const qFilled = q.atmosphere || q.feeling || q.appearance_concerns || q.reference_images.length || q.message;
    const questionnaire = qFilled ? { ...q, is_skipped: false } : { is_skipped: true };

    wx.cloud.callFunction({
      name: 'booking',
      data: {
        action: 'createOrder',
        order_type: orderType,
        package_id: this.data.selectedPackage._id || undefined,
        equipment_items: equipmentItems,
        shooting_date: this.data.form.shooting_date,
        shooting_location: this.data.form.shooting_location,
        contact_name: this.data.form.contact_name,
        contact_phone: this.data.form.contact_phone,
        remark: this.data.form.remark,
        questionnaire: questionnaire
      }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        const orderId = res.result.data.order_id;
        // 清除草稿
        that.clearDraft();
        // 发起支付
        that.payOrder(orderId);
      } else {
        wx.showToast({ title: res.result.msg || '下单失败', icon: 'none' });
        that.setData({ submitting: false });
      }
    }).catch(err => {
      console.error(err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      that.setData({ submitting: false });
    });
  },

  // 支付（沙箱）
  payOrder: function (orderId) {
    const that = this;
    wx.cloud.callFunction({
      name: 'pay',
      data: { action: 'mockPay', order_id: orderId }
    }).then(res => {
      that.setData({ submitting: false });
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '预约成功！', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/order-detail/order-detail?id=' + orderId });
        }, 1500);
      } else {
        wx.showToast({ title: res.result.msg || '支付失败', icon: 'none' });
      }
    }).catch(() => {
      that.setData({ submitting: false });
      // 云函数未部署时模拟成功
      wx.showToast({ title: '预约成功（模拟）', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    });
  }
});
