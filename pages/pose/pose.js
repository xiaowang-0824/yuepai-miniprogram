// pages/pose/pose.js 美姿灵感
const themeUtil = require('../../utils/theme.js');

Page({
  data: {
    theme: null,
    pageStyle: '',
    categories: ['站姿', '坐姿', '动态抓拍', '情绪氛围感', '双人情侣', '短视频运镜姿势'],
    currentCat: '',
    materials: []
  },

  onLoad: function () {
    const theme = themeUtil.getTheme();
    this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    this.loadMaterials();
  },

  onShow: function () {
    const theme = themeUtil.getTheme();
    if (theme.theme_key !== this.data.theme.theme_key) {
      this.setData({ theme, pageStyle: themeUtil.getPageStyle(theme) });
    }
  },

  switchCat: function (e) {
    this.setData({ currentCat: e.currentTarget.dataset.cat });
    this.loadMaterials();
  },

  loadMaterials: function () {
    const that = this;
    wx.cloud.callFunction({
      name: 'content',
      data: { action: 'getPoseMaterials', category: that.data.currentCat || undefined, page: 1, pageSize: 50 }
    }).then(res => {
      let list = [];
      if (res.result && res.result.code === 0) list = res.result.data.list || [];
      if (!list.length) list = that.getMockMaterials();
      that.setData({ materials: list });
    }).catch(() => that.setData({ materials: that.getMockMaterials() }));
  },

  previewImage: function (e) {
    const urls = this.data.materials.map(m => m.image_url);
    wx.previewImage({ current: e.currentTarget.dataset.url, urls });
  },

  getMockMaterials: function () {
    const tips = [
      '肩膀微微下沉，下巴轻收，眼神望向镜头外的远方～',
      '手自然搭在身侧，重心放在一条腿上，身体呈S型线条',
      '走动起来让摄影师抓拍，裙摆飘动会很有灵动感',
      '闭眼感受光线，侧脸轮廓会特别柔和',
      '两人靠近些，额头相抵，自然微笑就好'
    ];
    const cats = ['站姿', '坐姿', '动态抓拍', '情绪氛围感', '双人情侣'];
    const list = [];
    for (let i = 0; i < 8; i++) {
      list.push({
        _id: 'm' + i,
        category: cats[i % cats.length],
        image_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent('pose photography ' + cats[i % cats.length]) + '&image_size=portrait_4_3',
        tip: tips[i % tips.length]
      });
    }
    return list;
  }
});
