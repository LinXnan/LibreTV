const CUSTOMER_SITES = {
	niuniuziyuan: {
		api: 'https://api.niuniuzy.me/api.php/provide/vod',
		name: '牛牛视频',
	},
	zuidaziyuan: {
		api: 'http://zuidazy.me/api.php/provide/vod',
		name: '最大资源',
	},
	maotaiziyuan: {
		api: 'https://caiji.maotaizy.cc/api.php/provide/vod/at/josn',
		name: '茅台资源',
	},
	yinghuaziyuan: {
		api: 'http://m3u8.apiyhzy.com/api.php/provide/vod',
		name: '樱花资源',
	},
	jisuziyuan: {
		api: 'https://jszyapi.com/api.php/provide/vod/at/json',
		name: '极速资源',
	},
	1080zyku: {
		api: 'http://api.1080zyku.com/inc/api.php/provide/vod',
		name: '1080资源',
	},
	liangziziyuan: {
		api: 'http://cj.lziapi.com/api.php/provide/vod/from/lzm3u8',
		name: '量子资源',
	},
	baofengziyuan: {
		api: 'https://bfzyapi.com/api.php/provide/vod',
		name: '暴风资源',
	},
	wolongziyuan: {
		api: 'http://collect.wolongzyw.com/api.php/provide/vod',
		name: '卧龙资源',
	},
	dianyingtiantang: {
		api: 'http://caiji.dyttzyapi.com/api.php/provide/vod/at/xml',
		name: '电影天堂',
	},
	tianyayingshiziyuan: {
		api: 'https://tyyszyapi.com/api.php/provide/vod',
		name: '天涯影视',
	},
	guangsuziyuan: {
		api: 'https://api.guangsuapi.com/api.php/provide/vod/from/gsm3u8',
		name: '光速资源',
	},
	baiduziyuan: {
		api: 'http://api.apibdzy.com/api.php/provide/vod',
		name: '百度资源',
	},
	modouziyuan: {
		api: 'https://www.mdzyapi.com/api.php/provide/vod',
		name: '魔都资源',
	},
	doubanziyuan: {
		api: 'https://caiji.dbzy5.com/api.php/provide/vod/at/josn',
		name: '豆瓣资源',
	},
	maoyanziyuan: {
		api: 'https://api.maoyanapi.top/api.php/provide/vod',
		name: '猫眼资源',
	},
	shandianziyuan: {
		api: 'http://sdzyapi.com/api.php/provide/vod/from/sdm3u8',
		name: '闪电资源',
	},
	hongniuziyuan: {
		api: 'http://hongniuzy2.com/api.php/provide/vod/from/hnm3u8',
		name: '红牛资源',
	},
	suboziyuan: {
		api: 'https://subocj.com/api.php/provide/vod/at/json',
		name: '速播资源',
	}
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
