// cloudfunctions/manage/index.js
// 管理员内容管理云函数：套餐、作品、作品集、器材、美姿 的增删改查
// 所有操作前置校验管理员权限
const { db, success, fail, getOpenid, requireAdmin, softDelete } = require('./utils');

exports.main = async (event) => {
  const { action } = event;
  const openid = getOpenid();

  // 全部 action 均需管理员权限
  const auth = await requireAdmin(openid);
  if (auth.error) return auth.error;

  try {
    switch (action) {
      // 作品集
      case 'createPortfolio':  return await createPortfolio(event);
      case 'updatePortfolio':  return await updatePortfolio(event);
      case 'deletePortfolio':  return await deletePortfolio(event);
      case 'listPortfolios':   return await listPortfolios(event);
      // 作品
      case 'createWork':       return await createWork(event);
      case 'updateWork':       return await updateWork(event);
      case 'deleteWork':       return await deleteWork(event);
      case 'listWorks':        return await listWorks(event);
      // 套餐
      case 'createPackage':    return await createPackage(event);
      case 'updatePackage':    return await updatePackage(event);
      case 'deletePackage':    return await deletePackage(event);
      case 'togglePackageStatus': return await togglePackageStatus(event);
      case 'listPackages':     return await listPackages(event);
      // 器材
      case 'createEquipment':  return await createEquipment(event);
      case 'updateEquipment':  return await updateEquipment(event);
      case 'deleteEquipment':  return await deleteEquipment(event);
      case 'toggleEquipmentStatus': return await toggleEquipmentStatus(event);
      case 'listEquipment':    return await listEquipment(event);
      // 美姿
      case 'createPoseMaterial':   return await createPoseMaterial(event);
      case 'updatePoseMaterial':   return await updatePoseMaterial(event);
      case 'deletePoseMaterial':   return await deletePoseMaterial(event);
      case 'listPoseMaterials':    return await listPoseMaterials(event);
      default: return fail(400, '未知的 action');
    }
  } catch (err) {
    console.error('[manage] error:', err);
    return fail(500, '服务器错误');
  }
};

const now = () => db.serverDate();

// ============ 作品集 ============
async function createPortfolio(event) {
  const { title, cover_image, category, description, sort = 0 } = event;
  if (!title) return fail(400, '缺少标题');
  const data = {
    title, cover_image: cover_image || '', category: category || '',
    description: description || '', works_count: 0,
    sort, status: 1, is_deleted: false,
    create_time: now(), update_time: now()
  };
  const res = await db.collection('portfolios').add({ data });
  return success({ _id: res._id });
}

async function updatePortfolio(event) {
  const { _id, ...fields } = event;
  if (!_id) return fail(400, '缺少 _id');
  fields.update_time = now();
  await db.collection('portfolios').doc(_id).update({ data: fields });
  return success({});
}

async function deletePortfolio(event) {
  const { _id } = event;
  if (!_id) return fail(400, '缺少 _id');
  // 软删除作品集，并将其下作品的 portfolio_id 置空
  await softDelete('portfolios', _id);
  await db.collection('works').where({ portfolio_id: _id }).update({
    data: { portfolio_id: '', update_time: now() }
  });
  return success({});
}

async function listPortfolios(event) {
  const { status, page = 1, pageSize = 50 } = event;
  const cond = { is_deleted: false };
  if (status !== undefined) cond.status = status;
  const res = await db.collection('portfolios').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();
  return success({ list: res.data });
}

// ============ 作品 ============
async function createWork(event) {
  const { type, file_url, thumbnail_url, title, description, category, portfolio_id = '', sort = 0 } = event;
  if (!type || !file_url) return fail(400, '缺少 type 或 file_url');
  const data = {
    type, file_url, thumbnail_url: thumbnail_url || '',
    title: title || '', description: description || '',
    category: category || '', portfolio_id,
    sort, status: 1, is_deleted: false,
    create_time: now(), update_time: now()
  };
  const res = await db.collection('works').add({ data });
  return success({ _id: res._id });
}

async function updateWork(event) {
  const { _id, ...fields } = event;
  if (!_id) return fail(400, '缺少 _id');
  fields.update_time = now();
  await db.collection('works').doc(_id).update({ data: fields });
  return success({});
}

async function deleteWork(event) {
  const { _id } = event;
  if (!_id) return fail(400, '缺少 _id');
  await softDelete('works', _id);
  return success({});
}

async function listWorks(event) {
  const { category, portfolio_id, status, page = 1, pageSize = 50 } = event;
  const cond = { is_deleted: false };
  if (category) cond.category = category;
  if (portfolio_id !== undefined) cond.portfolio_id = portfolio_id;
  if (status !== undefined) cond.status = status;
  const res = await db.collection('works').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();
  return success({ list: res.data });
}

// ============ 套餐 ============
async function createPackage(event) {
  const { name, type, category, description, cover_image, sample_images = [], sample_videos = [],
    price, duration, included_items = [], notice = '', sort = 0 } = event;
  if (!name || !type || price === undefined) return fail(400, '缺少必填字段');
  const data = {
    name, type, category: category || '', description: description || '',
    cover_image: cover_image || '', sample_images, sample_videos,
    price, duration: duration || 0, included_items, notice,
    sort, status: 1, is_deleted: false,
    create_time: now(), update_time: now()
  };
  const res = await db.collection('packages').add({ data });
  return success({ _id: res._id });
}

async function updatePackage(event) {
  const { _id, ...fields } = event;
  if (!_id) return fail(400, '缺少 _id');
  fields.update_time = now();
  await db.collection('packages').doc(_id).update({ data: fields });
  return success({});
}

async function deletePackage(event) {
  const { _id } = event;
  if (!_id) return fail(400, '缺少 _id');
  await softDelete('packages', _id);
  return success({});
}

async function togglePackageStatus(event) {
  const { _id, status } = event;
  if (!_id || status === undefined) return fail(400, '缺少参数');
  await db.collection('packages').doc(_id).update({
    data: { status, update_time: now() }
  });
  return success({});
}

async function listPackages(event) {
  const { status, page = 1, pageSize = 50 } = event;
  const cond = { is_deleted: false };
  if (status !== undefined) cond.status = status;
  const res = await db.collection('packages').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();
  return success({ list: res.data });
}

// ============ 器材 ============
async function createEquipment(event) {
  const { name, category, brand = '', model = '', description = '', images = [],
    daily_rent, deposit, stock = 1, care_notice = '' } = event;
  if (!name || daily_rent === undefined) return fail(400, '缺少必填字段');
  const data = {
    name, category: category || '', brand, model, description, images,
    daily_rent, deposit: deposit || 0, stock, care_notice,
    status: 1, is_deleted: false, sort: 0,
    create_time: now(), update_time: now()
  };
  const res = await db.collection('equipment').add({ data });
  return success({ _id: res._id });
}

async function updateEquipment(event) {
  const { _id, ...fields } = event;
  if (!_id) return fail(400, '缺少 _id');
  fields.update_time = now();
  await db.collection('equipment').doc(_id).update({ data: fields });
  return success({});
}

async function deleteEquipment(event) {
  const { _id } = event;
  if (!_id) return fail(400, '缺少 _id');
  await softDelete('equipment', _id);
  return success({});
}

async function toggleEquipmentStatus(event) {
  const { _id, status } = event;
  if (!_id || status === undefined) return fail(400, '缺少参数');
  await db.collection('equipment').doc(_id).update({
    data: { status, update_time: now() }
  });
  return success({});
}

async function listEquipment(event) {
  const { status, page = 1, pageSize = 50 } = event;
  const cond = { is_deleted: false };
  if (status !== undefined) cond.status = status;
  const res = await db.collection('equipment').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();
  return success({ list: res.data });
}

// ============ 美姿素材 ============
async function createPoseMaterial(event) {
  const { category, image_url, tip = '', sort = 0 } = event;
  if (!category || !image_url) return fail(400, '缺少必填字段');
  const data = {
    category, image_url, tip, sort, status: 1, is_deleted: false,
    create_time: now(), update_time: now()
  };
  const res = await db.collection('pose_materials').add({ data });
  return success({ _id: res._id });
}

async function updatePoseMaterial(event) {
  const { _id, ...fields } = event;
  if (!_id) return fail(400, '缺少 _id');
  fields.update_time = now();
  await db.collection('pose_materials').doc(_id).update({ data: fields });
  return success({});
}

async function deletePoseMaterial(event) {
  const { _id } = event;
  if (!_id) return fail(400, '缺少 _id');
  await softDelete('pose_materials', _id);
  return success({});
}

async function listPoseMaterials(event) {
  const { category, status, page = 1, pageSize = 50 } = event;
  const cond = { is_deleted: false };
  if (category) cond.category = category;
  if (status !== undefined) cond.status = status;
  const res = await db.collection('pose_materials').where(cond)
    .orderBy('sort', 'desc').orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize).limit(pageSize).get();
  return success({ list: res.data });
}
