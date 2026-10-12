// cloudfunctions/content/index.js
// 内容查询云函数：作品集、作品、套餐、器材、美姿、主题 的公开读取
const { db, success, fail, getDateRange, _ } = require('./utils');

exports.main = async (event) => {
  const { action } = event;
  try {
    switch (action) {
      case 'getPortfolios':     return await getPortfolios(event);
      case 'getPortfolioDetail':return await getPortfolioDetail(event);
      case 'getWorks':          return await getWorks(event);
      case 'getWorkDetail':     return await getWorkDetail(event);
      case 'getPackages':       return await getPackages(event);
      case 'getPackageDetail':  return await getPackageDetail(event);
      case 'getEquipment':      return await getEquipment(event);
      case 'getEquipmentDetail':return await getEquipmentDetail(event);
      case 'getPoseMaterials':  return await getPoseMaterials(event);
      case 'getThemes':         return await getThemes();
      case 'getLockedEquipIds': return await getLockedEquipIds(event);
      default: return fail(400, '未知的 action');
    }
  } catch (err) {
    console.error('[content] error:', err);
    return fail(500, '服务器错误');
  }
};

// 公开查询通用条件
function publicCond() {
  return { is_deleted: false, status: 1 };
}

async function getPortfolios(event) {
  const { category, page = 1, pageSize = 10 } = event;
  const cond = publicCond();
  if (category) cond.category = category;

  const countRes = await db.collection('portfolios').where(cond).count();
  const res = await db.collection('portfolios').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();

  return success({ list: res.data, total: countRes.total });
}

async function getPortfolioDetail(event) {
  const { portfolio_id } = event;
  if (!portfolio_id) return fail(400, '缺少 portfolio_id');

  const pf = await db.collection('portfolios').doc(portfolio_id).get();
  // 作品集下的作品
  const worksRes = await db.collection('works')
    .where({ portfolio_id, is_deleted: false, status: 1 })
    .orderBy('sort', 'desc').get();

  return success({ portfolio: pf.data, works: worksRes.data });
}

async function getWorks(event) {
  const { category, portfolio_id, page = 1, pageSize = 20 } = event;
  const cond = publicCond();
  if (category) cond.category = category;
  if (portfolio_id !== undefined) cond.portfolio_id = portfolio_id;

  const countRes = await db.collection('works').where(cond).count();
  const res = await db.collection('works').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();

  return success({ list: res.data, total: countRes.total });
}

async function getWorkDetail(event) {
  const { work_id } = event;
  if (!work_id) return fail(400, '缺少 work_id');
  const res = await db.collection('works').doc(work_id).get();
  return success({ work: res.data });
}

async function getPackages(event) {
  const { type, category, page = 1, pageSize = 20 } = event;
  const cond = publicCond();
  if (type) cond.type = type;
  if (category) cond.category = category;

  const countRes = await db.collection('packages').where(cond).count();
  const res = await db.collection('packages').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();

  return success({ list: res.data, total: countRes.total });
}

async function getPackageDetail(event) {
  const { package_id } = event;
  if (!package_id) return fail(400, '缺少 package_id');
  const res = await db.collection('packages').doc(package_id).get();
  return success({ package: res.data });
}

async function getEquipment(event) {
  const { category, page = 1, pageSize = 50 } = event;
  const cond = publicCond();
  if (category) cond.category = category;

  const countRes = await db.collection('equipment').where(cond).count();
  const res = await db.collection('equipment').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();

  return success({ list: res.data, total: countRes.total });
}

async function getEquipmentDetail(event) {
  const { equipment_id } = event;
  if (!equipment_id) return fail(400, '缺少 equipment_id');
  const res = await db.collection('equipment').doc(equipment_id).get();
  return success({ equipment: res.data });
}

async function getPoseMaterials(event) {
  const { category, page = 1, pageSize = 50 } = event;
  const cond = publicCond();
  if (category) cond.category = category;

  const countRes = await db.collection('pose_materials').where(cond).count();
  const res = await db.collection('pose_materials').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();

  return success({ list: res.data, total: countRes.total });
}

async function getThemes() {
  const res = await db.collection('theme_config')
    .where({ status: 1 }).orderBy('sort', 'asc').get();
  return success({ list: res.data });
}

// 查询指定日期区间内被锁定的器材ID列表（供前端器材列表置灰）
async function getLockedEquipIds(event) {
  const { date, days = 1 } = event;
  if (!date) return success({ locked_ids: [] });

  const dates = getDateRange(date, days);
  const res = await db.collection('schedules').where({
    schedule_type: 'equip_lock',
    status: _.in([1]),
    is_deleted: false,
    date: _.in(dates)
  }).get();

  const lockedIds = new Set();
  res.data.forEach(s => {
    (s.lock_equip_ids || []).forEach(id => lockedIds.add(id));
  });
  return success({ locked_ids: Array.from(lockedIds) });
}
