// app.js
// 光影记事小程序 - 全局入口
// 职责：云开发初始化、主题系统、全局用户态

App({
  globalData: {
    userInfo: null,      // 用户信息
    openid: null,        // 微信openid
    isAdmin: false,      // 是否管理员
    theme: null,         // 当前主题配色对象
    cloudEnv: 'your-cloud-env-id' // 云开发环境ID，部署时替换
  },

  // 四套主题配色（与 theme_config 集合初始数据一致）
  themes: {
    theme1: {
      theme_key: 'theme1',
      name: '清透米白·柔光纪实风',
      primary: '#A89889',      // 主色：浅奶茶棕
      secondary: '#D9CFC4',    // 辅助色：浅燕麦
      background: '#F9F7F4',   // 背景：米白
      text_primary: '#4A443F', // 正文：深暖灰
      text_secondary: '#877E75', // 次要文字
      accent: '#C87B69'        // 强调：低饱和砖红
    },
    theme2: {
      theme_key: 'theme2',
      name: '冷调浅灰·极简高级感',
      primary: '#6B7B8C',
      secondary: '#B9C2CC',
      background: '#F5F7F9',
      text_primary: '#343A40',
      text_secondary: '#747C86',
      accent: '#738CA6'
    },
    theme3: {
      theme_key: 'theme3',
      name: '低饱和苔绿·自然故事感',
      primary: '#7C8B79',
      secondary: '#B4C1B0',
      background: '#F6F8F4',
      text_primary: '#3F473D',
      text_secondary: '#707A6E',
      accent: '#A47A66'
    },
    theme4: {
      theme_key: 'theme4',
      name: '淡紫灰·梦幻柔焦感',
      primary: '#9A8FA8',
      secondary: '#D2C9DD',
      background: '#F7F5FA',
      text_primary: '#46404E',
      text_secondary: '#80768C',
      accent: '#B98E96'
    }
  },

  onLaunch: function () {
    // 1. 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: this.globalData.cloudEnv,
        traceUser: true
      });
    }

    // 2. 加载主题（从本地缓存读取，默认 theme1）
    const savedThemeKey = wx.getStorageSync('theme_key') || 'theme1';
    this.globalData.theme = this.themes[savedThemeKey] || this.themes.theme1;

    // 3. 尝试静默获取 openid（调用 user 云函数 login）
    this.silentLogin();
  },

  /**
   * 静默登录：获取 openid 和用户信息
   * 不弹授权框，仅通过云函数拿 openid
   */
  silentLogin: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'user',
      data: { action: 'login' }
    }).then(res => {
      if (res.result && res.result.code === 0) {
        that.globalData.openid = res.result.data.openid;
        that.globalData.userInfo = res.result.data.user;
        that.globalData.isAdmin = res.result.data.is_admin;
      }
    }).catch(err => {
      // 云函数未部署时降级，不影响页面浏览
      console.warn('静默登录失败（云函数可能未部署）：', err);
    });
  },

  /**
   * 切换主题
   * @param {string} themeKey - 主题标识 theme1~theme4
   * @returns {object} 切换后的主题对象
   */
  switchTheme: function (themeKey) {
    const theme = this.themes[themeKey];
    if (!theme) return this.globalData.theme;
    this.globalData.theme = theme;
    wx.setStorageSync('theme_key', themeKey);
    // 同步导航栏颜色
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: theme.background
    });
    return theme;
  },

  /**
   * 获取当前主题
   */
  getTheme: function () {
    return this.globalData.theme || this.themes.theme1;
  }
});
