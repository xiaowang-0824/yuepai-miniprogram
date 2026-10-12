// cloudfunctions/schedule/index.js
// 档期云函数：月历查询、当日详情、手动新增线下档期
const {
  db, success, fail, getOpenid, requireAdmin, checkScheduleConflict,
  getDateRange, formatDate
} = require('./utils');

const PHOTOGRAPHER_ID = 'default';

exports.main = async (event) => {
  const { action } = event;
  const openid = getOpenid();

  // 全部操作仅管理员
  const auth = await requireAdmin(openid);
  if (auth.error) return auth.error;

  try {
    switch (action) {
      case 'getMonthSchedules':   return await getMonthSchedules(event);
      case 'getDaySchedules':     return await getDaySchedules(event);
      case 'createManualSchedule':return await createManualSchedule(event);
      case 'deleteSchedule':      return await deleteSchedule(event);
      default: return fail(400, '未知的 action');
    }
  } catch (err) {
    console.error('[schedule] error:', err);
    return fail(500, '服务器错误');
  }
};

// 月历数据：返回该月所有档期
async function getMonthSchedules(event) {
  const { year, month } = event;
  if (!year || !month) return fail(400, '缺少 year 或 month');

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const res = await db.collection('schedules')
    .where({
      is_deleted: false,
      status: db.command.in([1, 2]),
      date: db.command.gte(startDate).and(db.command.lt(endDate))
    })
    .get();

  return success({ list: res.data });
}

// 某日档期详情
async function getDaySchedules(event) {
  const { date } = event;
  if (!date) return fail(400, '缺少 date');

  const res = await db.collection('schedules')
    .where({ date, is_deleted: false, status: db.command.in([1, 2]) })
    .get();

  const photoList = res.data.filter(s => s.schedule_type === 'photo');
  const equipmentList = res.data.filter(s => s.schedule_type === 'equipment');
  const blockList = res.data.filter(s => s.schedule_type === 'block');
  const equipLockList = res.data.filter(s => s.schedule_type === 'equip_lock');

  return success({
    photo_list: photoList,
    equipment_list: equipmentList,
    block_list: blockList,
    equip_lock_list: equipLockList
  });
}

// 手动新增档期：支持 photo/equipment/block/equip_lock，支持连续多天批量创建
async function createManualSchedule(event) {
  const {
    schedule_type, date, end_date = '',
    start_time = '', end_time = '',
    equipment_id = '', customer_name = '', location = '', remark = '',
    block_reason = '', block_scope = 'photo_only',
    lock_equip_ids = [], lock_reason = ''
  } = event;

  if (!schedule_type || !date) return fail(400, '缺少 schedule_type 或 date');
  if (schedule_type === 'equip_lock' && (!lock_equip_ids || !lock_equip_ids.length)) {
    return fail(400, '器材锁定需选择器材');
  }

  // 生成日期区间（单日或连续多天）
  let dates = [date];
  if (end_date && end_date > date) {
    const days = Math.ceil((new Date(end_date) - new Date(date)) / 86400000) + 1;
    dates = getDateRange(date, days);
  }

  // 已有有效订单日期禁止新增 block / equip_lock
  if (schedule_type === 'block' || schedule_type === 'equip_lock') {
    const orderCond = {
      is_deleted: false,
      status: db.command.in([1, 2]),
      date: db.command.in(dates)
    };
    if (schedule_type === 'block') {
      // block 拦截已有拍摄订单；若 scope=all 还需拦截已有器材租赁订单
      const types = block_scope === 'all' ? ['photo', 'equipment'] : ['photo'];
      orderCond.schedule_type = db.command.in(types);
    } else {
      // equip_lock 检查指定器材是否已有租赁档期
      orderCond.schedule_type = 'equipment';
      orderCond.equipment_id = db.command.in(lock_equip_ids);
    }
    const occRes = await db.collection('schedules').where(orderCond).limit(1).get();
    if (occRes.data.length > 0) {
      return fail(400, schedule_type === 'block'
        ? '该日期已有订单，无法新增封锁'
        : '该器材在此日期已有租赁订单，无法锁定');
    }
  } else {
    // photo / equipment 原有冲突校验
    const conflict = await checkScheduleConflict({
      dates, schedule_type,
      equipment_id: equipment_id || undefined,
      photographer_id: PHOTOGRAPHER_ID
    });
    if (conflict.conflict) return fail(400, conflict.reason);
  }

  const now = db.serverDate();
  const baseData = {
    schedule_type,
    order_id: '',
    is_manual: true,
    photographer_id: PHOTOGRAPHER_ID,
    status: 1,
    is_deleted: false,
    create_time: now,
    update_time: now
  };

  const createdIds = [];
  for (const d of dates) {
    const data = { ...baseData, date: d };
    if (schedule_type === 'photo' || schedule_type === 'equipment') {
      data.start_time = start_time;
      data.end_time = end_time;
      data.equipment_id = schedule_type === 'equipment' ? equipment_id : '';
      data.customer_name = customer_name;
      data.location = location;
      data.remark = remark;
    } else if (schedule_type === 'block') {
      data.block_reason = block_reason;
      data.block_scope = block_scope; // photo_only | all
    } else if (schedule_type === 'equip_lock') {
      data.lock_equip_ids = lock_equip_ids;
      data.lock_reason = lock_reason;
    }
    const res = await db.collection('schedules').add({ data });
    createdIds.push(res._id);
  }

  return success({ schedule_ids: createdIds, count: createdIds.length });
}

// 删除档期（手动档期直接删；订单档期需先取消订单）
async function deleteSchedule(event) {
  const { schedule_id } = event;
  if (!schedule_id) return fail(400, '缺少 schedule_id');

  const sRes = await db.collection('schedules').doc(schedule_id).get();
  const schedule = sRes.data;
  if (!schedule) return fail(404, '档期不存在');

  if (!schedule.is_manual && schedule.order_id) {
    return fail(400, '该档期关联订单，请先取消订单');
  }

  await db.collection('schedules').doc(schedule_id).update({
    data: { status: 0, is_deleted: true, update_time: db.serverDate() }
  });

  return success({});
}
