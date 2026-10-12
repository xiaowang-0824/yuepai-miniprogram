// cloudfunctions/user/index.js
// 用户云函数：登录、获取/更新用户信息
const { db, success, fail, getOpenid, requireLogin } = require('./utils');

exports.main = async (event) => {
  const { action } = event;
  const openid = getOpenid();

  try {
    switch (action) {
      case 'login':
        return await login(openid, event);
      case 'getProfile':
        return await getProfile(openid);
      case 'updateProfile':
        return await updateProfile(openid, event);
      default:
        return fail(400, '未知的 action');
    }
  } catch (err) {
    console.error('[user] error:', err);
    return fail(500, '服务器错误');
  }
};

// 登录：首次写入 users，已存在则更新昵称头像
async function login(openid, event) {
  const { nickname, avatar_url } = event;
  const now = db.serverDate();

  const res = await db.collection('users').where({ openid }).limit(1).get();

  if (res.data.length > 0) {
    // 已存在，更新昵称头像
    const user = res.data[0];
    await db.collection('users').doc(user._id).update({
      data: {
        nickname: nickname || user.nickname,
        avatar_url: avatar_url || user.avatar_url,
        update_time: now
      }
    });
    return success({
      openid,
      user: { ...user, nickname: nickname || user.nickname, avatar_url: avatar_url || user.avatar_url },
      is_admin: !!user.is_admin
    });
  }

  // 首次登录，新建用户
  const newUser = {
    openid,
    nickname: nickname || '微信用户',
    avatar_url: avatar_url || '',
    phone: '',
    role: 'customer',
    is_admin: false,
    real_name: '',
    gender: 0,
    status: 1,
    is_deleted: false,
    create_time: now,
    update_time: now
  };
  const addRes = await db.collection('users').add({ data: newUser });
  return success({
    openid,
    user: { _id: addRes._id, ...newUser },
    is_admin: false
  });
}

// 获取当前用户信息
async function getProfile(openid) {
  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;
  return success({ user: auth.user });
}

// 更新用户资料（手机号、真实姓名）
async function updateProfile(openid, event) {
  const auth = await requireLogin(openid);
  if (auth.error) return auth.error;

  const { phone, real_name } = event;
  const updateData = { update_time: db.serverDate() };
  if (phone !== undefined) updateData.phone = phone;
  if (real_name !== undefined) updateData.real_name = real_name;

  await db.collection('users').doc(auth.user._id).update({ data: updateData });
  const updated = await db.collection('users').doc(auth.user._id).get();
  return success({ user: updated.data });
}
