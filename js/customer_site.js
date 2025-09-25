const CUSTOMER_SITES = {
   niuniuziyuan: {
    name: '牛牛视频',
    api: 'https://api.niuniuzy.me/api.php/provide/vod',
  },
  zuidaziyuan: {
    name: '最大资源',
    api: 'http://zuidazy.me/api.php/provide/vod',
  },
  yayaziyuan：{
    name: '丫丫资源',
    api: 'https://cj.yayazy.net/api.php/provide/vod',
  },
  maotaiziyuan:{
    name: '茅台资源',
    api: 'https://caiji.maotaizy.cc/api.php/provide/vod/at/josn',
  },
  yinghuaziyuan:{
    name: '樱花资源',
    api: 'http://m3u8.apiyhzy.com/api.php/provide/vod',
  },
  jinyingziyuan:{
    name: '金鹰资源',
    api: 'https://jyzyapi.com/provide/vod/from/jinyingm3u8',
  },
  wangwangduanju:{
    name: '旺旺短剧',
    api: 'https://wwzy.tv/api.php/provide/vod',
  },
  360ziyuau:{
    name: '360资源',
    api: 'https://360zy.com/api.php/provide/vod',
  },
  tianyiziyuan:{
    name: '天翼资源',
    api: 'https://www.911ysw.top/tianyi.php/provide/vod',
  },
  feifanziyuan:{
    name: '非凡资源',
    api: 'http://cj.ffzyapi.com/api.php/provide/vod/at/xml',
  },
  aiqiyiziyuan:{
    name: '爱奇艺资源',
    api: 'https://iqiyizyapi.com/api.php/provide/vod',
  },
  piaolingyingyuan:{
    name: '飘零影院',
    api: 'https://p2100.net/api.php/provide/vod',
  },
  jisuziyuan:{
    name: '极速资源',
    api: 'https://jszyapi.com/api.php/provide/vod/at/json',
  },
  1080zyku:{
    name: '1080资源',
    api: 'http://api.1080zyku.com/inc/api.php/provide/vod',
  },
  liangziziyuan:{
    name: '量子资源',
    api: 'http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8',
  },
  baofengziyuan:{
    name: '暴风资源',
    api: 'https://bfzyapi.com/api.php/provide/vod',
  },
  wolongziyuan:{
    name: '卧龙资源',
    api: 'http://collect.wolongzyw.com/api.php/provide/vod',
  },
  dianyingtiantang:{
    name: '电影天堂',
    api: 'http://caiji.dyttzyapi.com/api.php/provide/vod/at/xml',
  },
  tianyayingshiziyuan:{
    name: '天涯影视',
    api: 'https://tyyszyapi.com/api.php/provide/vod',
  },
  guangsuziyuan:{
    name: '光速资源',
    api: 'https://api.guangsuapi.com/api.php/provide/vod/from/gsm3u8',
  },
  baiduziyuan:{
    name: '百度资源',
    api: 'http://api.apibdzy.com/api.php/provide/vod',
  },
  modouziyuan:{
    name: '魔都资源',
    api: 'https://www.mdzyapi.com/api.php/provide/vod',
  },
  doubanziyuan:{
    name: '豆瓣资源',
    api: 'https://caiji.dbzy5.com/api.php/provide/vod/at/josn',
  },
  maoyanziyuan:{
    name: '猫眼资源',
    api: 'https://api.maoyanapi.top/api.php/provide/vod',
  },
  shandianziyuan:{
    name: '闪电资源',
    api: 'http://sdzyapi.com/api.php/provide/vod/from/sdm3u8',
  },
  hongniuziyuan:{
    name: '红牛资源',
    api: 'http://hongniuzy2.com/api.php/provide/vod/from/hnm3u8',
  },
  suboziyuan:{
    name: '速播资源',
    api: 'https://subocj.com/api.php/provide/vod/at/json',
  }


};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
