// cloudfunctions/common/utils.js
// 公共工具：统一响应、鉴权、档期冲突校验、通用方法
// 注意：部署时需将此文件复制到每个云函数目录下，各函数通过 require('./utils') 引用

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ===== 统一响应 =====
function success(data = {}, msg = 'success') {
  return { code: 0, msg, data };
}

function fail(code, msg) {
  return { code, msg };
}

// ===== 鉴权 =====
function getOpenid() {
  return cloud.getWXContext().OPENID;
}

async function getUser(openid) {
  const res = await db.collection('users').where({ openid, is_deleted: false }).limit(1).get();
  return res.data[0] || null;
}

// 校验管理员，返回 { error } 或 { user }
async function requireAdmin(openid) {
  const user = await getUser(openid);
  if (!user || !user.is_admin) {
    return { error: fail(403, '无管理员权限') };
  }
  return { user };
}

// 校验登录态
async function requireLogin(openid) {
  const user = await getUser(openid);
  if (!user) {
    return { error: fail(401, '请先登录') };
  }
  return { user };
}

// ===== 档期冲突校验 =====
// params: { dates: ['YYYY-MM-DD',...], schedule_type: 'photo'|'equipment', equipment_id?, photographer_id? }
async function checkScheduleConflict(params) {
  const { dates, schedule_type, equipment_id, photographer_id } = params;
  if (!dates || !dates.length || !schedule_type) {
    return { conflict: false };
  }

  const cond = {
    schedule_type,
    status: _.in([1, 2]),
    is_deleted: false,
    date: _.in(dates)
  };

  if (schedule_type === 'photo') {
    cond.photographer_id = photographer_id || 'default';
  } else if (schedule_type === 'equipment') {
    cond.equipment_id = equipment_id;
  }

  const res = await db.collection('schedules').where(cond).limit(1).get();
  if (res.data.length > 0) {
    return {
      conflict: true,
      reason: schedule_type === 'photo' ? '该日期已有拍摄安排，换个日子吧～' : '该器材在此日期已被预订'
    };
  }
  return { conflict: false };
}

// ===== 摄影师封锁（block）校验 =====
// params: { dates: ['YYYY-MM-DD',...], scope: 'photo'|'equipment'|'combo' }
// block.scope: 'photo_only' 仅拦截拍摄类；'all' 拦截全部
async function checkBlockConflict(params) {
  const { dates, scope } = params;
  if (!dates || !dates.length) return { conflict: false };

  const cond = {
    schedule_type: 'block',
    status: _.in([1]),
    is_deleted: false,
    date: _.in(dates)
  };

  // scope 决定是否被 all 封锁拦截
  if (scope === 'equipment') {
    // 纯器材租赁只被 block_scope=all 拦截
    cond.block_scope = 'all';
  }
  // photo/combo 被 photo_only 和 all 都拦截，无需额外条件

  const res = await db.collection('schedules').where(cond).limit(1).get();
  if (res.data.length > 0) {
    const b = res.data[0];
    const reason = b.block_scope === 'all'
      ? `摄影师${b.date}全天封锁，暂不接单`
      : `摄影师${b.date}拍摄档期封锁，器材可租`;
    return { conflict: true, reason, block_scope: b.block_scope };
  }
  return { conflict: false };
}

// ===== 器材锁定（equip_lock）校验 =====
// params: { dates: [...], equipIds: [equip_id,...] }
// 仅拦截独立器材租赁（equipment_only），不拦截拍摄订单自带器材
async function checkEquipLockConflict(params) {
  const { dates, equipIds } = params;
  if (!dates || !dates.length || !equipIds || !equipIds.length) {
    return { conflict: false };
  }

  for (const eid of equipIds) {
    const cond = {
      schedule_type: 'equip_lock',
      status: _.in([1]),
      is_deleted: false,
      date: _.in(dates),
      lock_equip_ids: eid
    };
    const res = await db.collection('schedules').where(cond).limit(1).get();
    if (res.data.length > 0) {
      return { conflict: true, reason: '该器材在所选日期被锁定，暂不可租', equipment_id: eid };
    }
  }
  return { conflict: false };
}

// 生成日期区间数组 [start, end]，含首尾
function getDateRange(startDateStr, days) {
  const dates = [];
  const start = new Date(startDateStr);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    dates.push(formatDate(d));
  }
  return dates;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ===== 订单号 =====
function genOrderNo() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = Date.now().toString().slice(-6);
  return `GY${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${ts}`;
}

// ===== 软删除更新 =====
async function softDelete(collection, id) {
  return db.collection(collection).doc(id).update({
    data: { is_deleted: true, update_time: db.serverDate() }
  });
}

module.exports = {
  db,
  cloud,
  _,
  success,
  fail,
  getOpenid,
  getUser,
  requireAdmin,
  requireLogin,
  checkScheduleConflict,
  checkBlockConflict,
  checkEquipLockConflict,
  getDateRange,
  formatDate,
  genOrderNo,
  softDelete
};
