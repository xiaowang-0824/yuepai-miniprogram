// cloudfunctions/timer/index.js
// 定时触发器：每5分钟执行
// 职责：清理超过15分钟未支付的订单，释放其 status=2 的软锁档期
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const PAY_TIMEOUT_MINUTES = 15; // 支付超时时间（分钟）

exports.main = async () => {
  const now = Date.now();
  const timeoutMs = PAY_TIMEOUT_MINUTES * 60 * 1000;
  const cutoff = new Date(now - timeoutMs);

  try {
    // 1. 查询超时的待支付订单
    // create_time 是 db.serverDate() 写入的 Date 对象，查询时用 Date 比较
    const res = await db.collection('orders')
      .where({
        order_status: 'pending_payment',
        is_deleted: false,
        create_time: _.lt(cutoff)
      })
      .limit(100)
      .get();

    const orders = res.data;
    if (orders.length === 0) {
      return { code: 0, msg: 'no expired orders', count: 0 };
    }

    let cancelled = 0;
    for (const order of orders) {
      const nowDate = db.serverDate();

      // 2. 释放该订单的软锁档期（status=2 → 0）
      if (order.schedule_ids && order.schedule_ids.length) {
        await db.collection('schedules').where({
          _id: _.in(order.schedule_ids)
        }).update({
          data: { status: 0, update_time: nowDate }
        });
      }

      // 3. 标记订单为已取消
      await db.collection('orders').doc(order._id).update({
        data: {
          order_status: 'cancelled',
          cancel_reason: '支付超时，系统自动取消',
          update_time: nowDate
        }
      });

      cancelled++;
    }

    console.log(`[timer] 清理超时订单 ${cancelled} 条`);
    return { code: 0, msg: 'success', cancelled };
  } catch (err) {
    console.error('[timer] error:', err);
    return { code: 500, msg: 'timer error', error: err.message };
  }
};
