// cloudfunctions/booking/index.js
// 预约下单云函数：档期冲突校验、创建订单、写入问卷、创建待支付锁定档期（软锁）
const {
  db, success, fail, getOpenid, requireLogin,
  checkScheduleConflict, checkBlockConflict, checkEquipLockConflict,
  getDateRange, genOrderNo
} = require('./utils');

const PHOTOGRAPHER_ID = 'default'; // 一期单人管理员，默认摄影师

exports.main = async (event) => {
  const { action } = event;
  const openid = getOpenid();

  try {
    switch (action) {
      case 'checkSchedule': return await checkSchedule(event);
      case 'createOrder':   return await createOrder(openid, event);
      default: return fail(400, '未知的 action');
    }
  } catch (err) {
    console.error('[booking] error:', err);
    return fail(500, '服务器错误');
  }
};

// 档期预校验（前端选日期时调用）
async function checkSchedule(event) {
  const { date, type, equipment_ids = [], rent_days = 1 } = event;
  if (!date || !type) return fail(400, '缺少 date 或 type');

  // 拍摄档期只占一天；器材档期按租赁天数区间校验
  const photoDates = [date];
  const equipDates = getDateRange(date, rent_days || 1);

  // ① 摄影师封锁校验（前置）
  const blockScope = type === 'equipment' ? 'equipment' : (type === 'combo' ? 'combo' : 'photo');
  const blockConflict = await checkBlockConflict({ dates: photoDates, scope: blockScope });
  if (blockConflict.conflict) {
    return success({ available: false, conflict_reason: blockConflict.reason });
  }

  // ② 器材锁定校验（仅独立器材租赁受影响，拍摄订单自带器材不受限）
  if (type === 'equipment' && equipment_ids.length) {
    const lockConflict = await checkEquipLockConflict({ dates: equipDates, equipIds: equipment_ids });
    if (lockConflict.conflict) {
      return success({ available: false, conflict_reason: lockConflict.reason });
    }
  }

  // ③ 原有档期冲突校验
  if (type === 'photo' || type === 'combo') {
    const conflict = await checkScheduleConflict({
      dates: photoDates, schedule_type: 'photo', photographer_id: PHOTOGRAPHER_ID
    });
    if (conflict.conflict) {
      return success({ available: false, conflict_reason: conflict.reason });
    }
  }

  if (type === 'equipment' || type === 'combo') {
    for (const eid of equipment_ids) {
      const conflict = await checkScheduleConflict({
        dates: equipDates, schedule_type: 'equipment', equipment_id: eid
      });
      if (conflict.conflict) {
        return success({ available: false, conflict_reason: conflict.reason });
      }
    }
  }

  return success({ available: true });
}

// 创建订单
async function createOrder(openid, event) {
  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;

  const {
    order_type, package_id, equipment_items = [],
    shooting_date, shooting_location = '', contact_name, contact_phone,
    remark = '', questionnaire
  } = event;

  // 参数校验
  if (!order_type) return fail(400, '缺少 order_type');
  if (!shooting_date) return fail(400, '请选择拍摄日期');
  if (!contact_name) return fail(400, '请填写联系人');
  if (!/^1\d{10}$/.test(contact_phone)) return fail(400, '请填写正确的手机号');

  // 拍摄日期不能早于今天（云函数二次校验，防前端绕过）
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  if (shooting_date < todayStr) {
    return fail(400, '拍摄日期不能早于今天');
  }

  const hasPackage = order_type === 'photo_only' || order_type === 'combo';
  const hasEquipment = order_type === 'equipment_only' || order_type === 'combo';

  if (hasPackage && !package_id) return fail(400, '请选择拍摄套餐');
  if (hasEquipment && equipment_items.length === 0) return fail(400, '请选择租赁器材');

  // 取套餐快照
  let packageSnapshot = null;
  if (hasPackage) {
    const pkgRes = await db.collection('packages').doc(package_id).get();
    const pkg = pkgRes.data;
    if (!pkg || pkg.is_deleted || pkg.status !== 1) {
      return fail(400, '所选套餐不可用');
    }
    packageSnapshot = {
      _id: pkg._id, name: pkg.name, cover_image: pkg.cover_image,
      price: pkg.price, duration: pkg.duration, category: pkg.category
    };
  }

  // 校验器材并取快照
  const validEquipItems = [];
  if (hasEquipment) {
    for (const item of equipment_items) {
      const eqRes = await db.collection('equipment').doc(item.equipment_id).get();
      const eq = eqRes.data;
      if (!eq || eq.is_deleted || eq.status !== 1) {
        return fail(400, `器材 ${item.equipment_id} 不可用`);
      }
      validEquipItems.push({
        equipment_id: eq._id,
        snapshot: { name: eq.name, images: eq.images },
        daily_rent: eq.daily_rent,
        days: item.days || 1,
        subtotal: eq.daily_rent * (item.days || 1)
      });
    }
  }

  // 档期冲突校验（防前端绕过）
  const dates = [shooting_date];

  // ① 摄影师封锁前置校验
  const blockScope = hasEquipment && !hasPackage ? 'equipment' : (hasPackage && hasEquipment ? 'combo' : 'photo');
  const blockConflict = await checkBlockConflict({ dates, scope: blockScope });
  if (blockConflict.conflict) return fail(400, blockConflict.reason);

  // ② 器材锁定校验（仅独立器材租赁受影响）
  if (!hasPackage && hasEquipment) {
    const equipIds = validEquipItems.map(i => i.equipment_id);
    const allEquipDates = [];
    validEquipItems.forEach(item => {
      getDateRange(shooting_date, item.days).forEach(d => {
        if (!allEquipDates.includes(d)) allEquipDates.push(d);
      });
    });
    const lockConflict = await checkEquipLockConflict({ dates: allEquipDates, equipIds });
    if (lockConflict.conflict) return fail(400, lockConflict.reason);
  }

  // ③ 原有档期冲突校验
  if (hasPackage) {
    const c = await checkScheduleConflict({
      dates, schedule_type: 'photo', photographer_id: PHOTOGRAPHER_ID
    });
    if (c.conflict) return fail(400, c.reason);
  }
  if (hasEquipment) {
    for (const item of validEquipItems) {
      // 器材按租赁天数区间校验档期
      const equipDates = getDateRange(shooting_date, item.days);
      const c = await checkScheduleConflict({
        dates: equipDates, schedule_type: 'equipment', equipment_id: item.equipment_id
      });
      if (c.conflict) return fail(400, c.reason);
    }
  }

  // 计算金额
  let totalAmount = 0;
  if (packageSnapshot) totalAmount += packageSnapshot.price;
  let depositAmount = 0;
  validEquipItems.forEach(item => {
    totalAmount += item.subtotal;
    depositAmount += 0; // 押金在归还时退还，不计入实付（一期简化：可配置是否收取）
  });

  const orderNo = genOrderNo();
  const now = db.serverDate();

  // 创建订单
  const orderData = {
    order_no: orderNo,
    user_id: auth.user._id,
    order_type,
    package_id: package_id || '',
    package_snapshot: packageSnapshot,
    equipment_items: validEquipItems,
    shooting_date,
    shooting_location,
    contact_name,
    contact_phone,
    remark,
    questionnaire_id: '',
    total_amount: totalAmount,
    pay_amount: totalAmount,
    deposit_amount: depositAmount,
    order_status: 'pending_payment',
    pay_status: 'unpaid',
    is_mock_pay: true,
    schedule_ids: [],
    cancel_reason: '',
    is_deleted: false,
    create_time: now,
    update_time: now
  };
  const orderRes = await db.collection('orders').add({ data: orderData });
  const orderId = orderRes._id;

  // 创建待支付锁定档期（软锁 status=2）
  const scheduleIds = [];
  if (hasPackage) {
    const sRes = await db.collection('schedules').add({
      data: {
        schedule_type: 'photo',
        date: shooting_date,
        start_time: '', end_time: '',
        order_id: orderId,
        equipment_id: '',
        customer_name: contact_name,
        location: shooting_location,
        remark: '',
        is_manual: false,
        photographer_id: PHOTOGRAPHER_ID,
        status: 2, // 待支付锁定
        is_deleted: false,
        create_time: now,
        update_time: now
      }
    });
    scheduleIds.push(sRes._id);
  }
  if (hasEquipment) {
    for (const item of validEquipItems) {
      // 器材按租赁天数区间，每天创建一条档期记录
      const equipDates = getDateRange(shooting_date, item.days);
      for (const d of equipDates) {
        const sRes = await db.collection('schedules').add({
          data: {
            schedule_type: 'equipment',
            date: d,
            order_id: orderId,
            equipment_id: item.equipment_id,
            customer_name: contact_name,
            location: shooting_location,
            remark: `${item.days}天`,
            is_manual: false,
            photographer_id: PHOTOGRAPHER_ID,
            status: 2,
            is_deleted: false,
            create_time: now,
            update_time: now
          }
        });
        scheduleIds.push(sRes._id);
      }
    }
  }
  // 回写 schedule_ids
  await db.collection('orders').doc(orderId).update({
    data: { schedule_ids: scheduleIds }
  });

  // 写入问卷（若有填写）
  let questionnaireId = '';
  if (questionnaire && !questionnaire.is_skipped) {
    const qRes = await db.collection('questionnaires').add({
      data: {
        order_id: orderId,
        user_id: auth.user._id,
        atmosphere: questionnaire.atmosphere || '',
        feeling: questionnaire.feeling || '',
        appearance_concerns: questionnaire.appearance_concerns || '',
        reference_images: questionnaire.reference_images || [],
        message: questionnaire.message || '',
        is_skipped: false,
        is_deleted: false,
        create_time: now,
        update_time: now
      }
    });
    questionnaireId = qRes._id;
    await db.collection('orders').doc(orderId).update({
      data: { questionnaire_id: questionnaireId }
    });
  }

  return success({
    order_id: orderId,
    order_no: orderNo,
    total_amount: totalAmount
  });
}
