// cloudfunctions/initDb/index.js
// 数据库初始化云函数（仅执行一次）
// 职责：初始化 theme_config 4套主题、设置首个登录用户为管理员
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action } = event;
  try {
    if (action === 'initThemes') return await initThemes();
    if (action === 'setFirstAdmin') return await setFirstAdmin(event);
    return { code: 400, msg: '未知 action，可选: initThemes, setFirstAdmin' };
  } catch (err) {
    console.error('[initDb] error:', err);
    return { code: 500, msg: err.message };
  }
};

// 初始化 4 套主题（若集合为空则写入）
async function initThemes() {
  const countRes = await db.collection('theme_config').count();
  if (countRes.total > 0) {
    return { code: 0, msg: 'theme_config 已有数据，跳过初始化', count: countRes.total };
  }

  const themes = [
    { theme_key: 'theme1', name: '清透米白·柔光纪实风', primary: '#A89889', secondary: '#D9CFC4', background: '#F9F7F4', text_primary: '#4A443F', text_secondary: '#877E75', accent: '#C87B69', is_default: true, sort: 1, status: 1 },
    { theme_key: 'theme2', name: '冷调浅灰·极简高级感', primary: '#6B7B8C', secondary: '#B9C2CC', background: '#F5F7F9', text_primary: '#343A40', text_secondary: '#747C86', accent: '#738CA6', is_default: false, sort: 2, status: 1 },
    { theme_key: 'theme3', name: '低饱和苔绿·自然故事感', primary: '#7C8B79', secondary: '#B4C1B0', background: '#F6F8F4', text_primary: '#3F473D', text_secondary: '#707A6E', accent: '#A47A66', is_default: false, sort: 3, status: 1 },
    { theme_key: 'theme4', name: '淡紫灰·梦幻柔焦感', primary: '#9A8FA8', secondary: '#D2C9DD', background: '#F7F5FA', text_primary: '#46404E', text_secondary: '#80768C', accent: '#B98E96', is_default: false, sort: 4, status: 1 }
  ];

  for (const t of themes) {
    await db.collection('theme_config').add({ data: { ...t, create_time: db.serverDate(), update_time: db.serverDate() } });
  }
  return { code: 0, msg: 'theme_config 初始化成功', count: themes.length };
}

// 将指定 openid 的用户设为管理员（部署后手动调用一次）
async function setFirstAdmin(event) {
  const { openid } = event;
  if (!openid) return { code: 400, msg: '缺少 openid' };

  const res = await db.collection('users').where({ openid }).limit(1).get();
  if (res.data.length === 0) {
    return { code: 404, msg: '该用户不存在，请先在小程序登录一次' };
  }

  const user = res.data[0];
  await db.collection('users').doc(user._id).update({
    data: { is_admin: true, role: 'admin', update_time: db.serverDate() }
  });

  return { code: 0, msg: `已将 ${user.nickname || openid} 设为管理员` };
}
