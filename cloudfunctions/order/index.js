// cloudfunctions/order/index.js
// 订单云函数：查询、取消、状态流转
const { db, success, fail, getOpenid, requireLogin, requireAdmin, _ } = require('./utils');

// 合法状态流转白名单
// 一期：paid 状态不允许线上取消（cancelled），需线下沟通后走退款（refunded）
const STATUS_FLOW = {
  pending_payment: ['cancelled'],
  paid: ['in_progress', 'refunded'],
  in_progress: ['completed', 'refunded'],
  completed: ['refunded'],
  cancelled: [],
  refunded: []
};

exports.main = async (event) => {
  const { action } = event;
  const openid = getOpenid();

  try {
    switch (action) {
      case 'getMyOrders':      return await getMyOrders(openid, event);
      case 'getOrderDetail':   return await getOrderDetail(openid, event);
      case 'cancelOrder':      return await cancelOrder(openid, event);
      case 'listAllOrders':    return await listAllOrders(openid, event);
      case 'updateOrderStatus':return await updateOrderStatus(openid, event);
      default: return fail(400, '未知的 action');
    }
  } catch (err) {
    console.error('[order] error:', err);
    return fail(500, '服务器错误');
  }
};

// 我的订单列表
async function getMyOrders(openid, event) {
  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;

  const { status, page = 1, pageSize = 20 } = event;
  const cond = { user_id: auth.user._id, is_deleted: false };
  if (status) cond.order_status = status;

  const countRes = await db.collection('orders').where(cond).count();
  const res = await db.collection('orders').where(cond)
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();

  return success({ list: res.data, total: countRes.total });
}

// 订单详情（本人或管理员）
async function getOrderDetail(openid, event) {
  const { order_id } = event;
  if (!order_id) return fail(400, '缺少 order_id');

  const orderRes = await db.collection('orders').doc(order_id).get();
  const order = orderRes.data;
  if (!order) return fail(404, '订单不存在');

  // 权限：本人或管理员
  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;
  const isOwner = order.user_id === auth.user._id;
  const isAdmin = !!auth.user.is_admin;
  if (!isOwner && !isAdmin) return fail(403, '无权查看该订单');

  // 关联问卷
  let questionnaire = null;
  if (order.questionnaire_id) {
    try {
      const qRes = await db.collection('questionnaires').doc(order.questionnaire_id).get();
      questionnaire = qRes.data;
    } catch (e) { questionnaire = null; }
  }

  return success({ order, questionnaire });
}

// 取消订单（本人或管理员）
async function cancelOrder(openid, event) {
  const { order_id, reason = '用户取消' } = event;
  if (!order_id) return fail(400, '缺少 order_id');

  const orderRes = await db.collection('orders').doc(order_id).get();
  const order = orderRes.data;
  if (!order) return fail(404, '订单不存在');

  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;
  const isOwner = order.user_id === auth.user._id;
  const isAdmin = !!auth.user.is_admin;
  if (!isOwner && !isAdmin) return fail(403, '无权操作该订单');

  // 仅 pending_payment 可取消；paid 及以上状态需线下沟通
  if (order.order_status !== 'pending_payment') {
    return fail(400, '订单已支付，无法线上取消，请线下沟通');
  }

  const now = db.serverDate();
  // 释放档期
  if (order.schedule_ids && order.schedule_ids.length) {
    await db.collection('schedules').where({
      _id: _.in(order.schedule_ids)
    }).update({
      data: { status: 0, update_time: now }
    });
  }

  // 更新订单
  await db.collection('orders').doc(order_id).update({
    data: {
      order_status: 'cancelled',
      cancel_reason: reason,
      update_time: now
    }
  });

  return success({});
}

// 管理员：全部订单
async function listAllOrders(openid, event) {
  const auth = await requireAdmin(openid);
  if (auth.error) return auth.error;

  const { status, page = 1, pageSize = 50 } = event;
  const cond = { is_deleted: false };
  if (status) cond.order_status = status;

  const countRes = await db.collection('orders').where(cond).count();
  const res = await db.collection('orders').where(cond)
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();

  return success({ list: res.data, total: countRes.total });
}

// 管理员：更新订单状态
async function updateOrderStatus(openid, event) {
  const auth = await requireAdmin(openid);
  if (auth.error) return auth.error;

  const { order_id, order_status } = event;
  if (!order_id || !order_status) return fail(400, '缺少参数');

  const orderRes = await db.collection('orders').doc(order_id).get();
  const order = orderRes.data;
  if (!order) return fail(404, '订单不存在');

  // 校验状态流转合法性
  const allowed = STATUS_FLOW[order.order_status] || [];
  if (!allowed.includes(order_status)) {
    return fail(400, `订单状态不允许从 ${order.order_status} 转为 ${order_status}`);
  }

  const now = db.serverDate();
  await db.collection('orders').doc(order_id).update({
    data: { order_status, update_time: now }
  });

  return success({});
}
