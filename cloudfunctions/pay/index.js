// cloudfunctions/pay/index.js
// 支付云函数：沙箱 Mock 支付、真实支付骨架、支付成功后生成正式档期
const { db, success, fail, getOpenid, requireLogin, checkScheduleConflict, _ } = require('./utils');

const IS_MOCK_PAY = true; // 一期沙箱支付开关，二期改为 false
const PHOTOGRAPHER_ID = 'default';

exports.main = async (event) => {
  const { action } = event;
  const openid = getOpenid();

  try {
    switch (action) {
      case 'unifiedOrder': return await unifiedOrder(openid, event);
      case 'mockPay':      return await mockPay(openid, event);
      case 'payCallback':  return await payCallback(event);
      default: return fail(400, '未知的 action');
    }
  } catch (err) {
    console.error('[pay] error:', err);
    return fail(500, '服务器错误');
  }
};

// 支付下单
async function unifiedOrder(openid, event) {
  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;

  const { order_id } = event;
  if (!order_id) return fail(400, '缺少 order_id');

  const orderRes = await db.collection('orders').doc(order_id).get();
  const order = orderRes.data;
  if (!order) return fail(404, '订单不存在');
  if (order.user_id !== auth.user._id) return fail(403, '无权操作该订单');
  if (order.order_status !== 'pending_payment') return fail(400, '订单状态异常');

  // 二期真实支付时调用微信支付，一期直接走 mock
  if (IS_MOCK_PAY) {
    return await mockPay(openid, event);
  }

  // ===== 真实支付骨架（二期启用）=====
  // const res = await cloud.cloudPay.unifiedOrder({
  //   body: order.package_snapshot?.name || '摄影预约',
  //   outTradeNo: order.order_no,
  //   spbillCreateIp: '127.0.0.1',
  //   totalFee: order.pay_amount,
  //   envId: cloud.DYNAMIC_CURRENT_ENV,
  //   functionName: 'pay', // 回调云函数
  //   nonceStr: Math.random().toString(36).slice(2),
  //   tradeType: 'JSAPI',
  //   subAppid: ''
  // });
  // return success({ payment_params: res.payment });
  return fail(500, '真实支付未启用');
}

// 沙箱支付：直接标记支付成功，生成正式档期
async function mockPay(openid, event) {
  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;

  const { order_id } = event;
  if (!order_id) return fail(400, '缺少 order_id');

  const orderRes = await db.collection('orders').doc(order_id).get();
  const order = orderRes.data;
  if (!order) return fail(404, '订单不存在');
  if (order.user_id !== auth.user._id) return fail(403, '无权操作该订单');
  if (order.order_status !== 'pending_payment') return fail(400, '订单已支付或已取消');

  const now = db.serverDate();

  // 将软锁档期(status=2)转为正式档期(status=1)
  if (order.schedule_ids && order.schedule_ids.length) {
    await db.collection('schedules').where({
      _id: _.in(order.schedule_ids)
    }).update({
      data: { status: 1, update_time: now }
    });
  }

  // 更新订单为已支付
  await db.collection('orders').doc(order_id).update({
    data: {
      order_status: 'paid',
      pay_status: 'paid',
      pay_time: now,
      transaction_id: 'MOCK_' + Date.now(),
      update_time: now
    }
  });

  return success({ paid: true });
}

// 支付回调（真实支付时由微信调用）
async function payCallback(event) {
  // 二期真实支付回调处理
  // const { outTradeNo, transactionId, returnCode } = event;
  // if (returnCode === 'SUCCESS') {
  //   // 更新订单、生成档期（同 mockPay 逻辑）
  // }
  return success({});
}
