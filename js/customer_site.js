const CUSTOMER_SITES = {
	
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
	doubanziyuan: {
		api: 'https://caiji.dbzy5.com/api.php/provide/vod/at/josn',
		name: '豆瓣资源',
	},
	baiduyunziyuan: {
		api: 'https://api.apibdzy.com/api.php/provide/vod',
		name: '百度云资源',
	},
	wujinziyuan: {
		api: 'https://api.wujinapi.com/api.php/provide/vod',
		name: '无尽资源',
	},
	guangsu: {
		api: 'http://api.guangsuapi.com/api.php/provide/vod/from/gsm3u8',
		name: '光速资源',
	},
	'360ziyuan': {
		api: 'https://360zy.com/api.php/provide/vod',
		name: '360资源',
	},
	haohaoziyuan: {
		api: 'https://hhzyapi.com/api.php/provide/vod',
		name: '好好资源',
	},
	huya: {
		api: 'https://www.huyaapi.com/api.php/provide/vod',
		name: '虎牙资源',
	},
	p2100ziyuan: {
		api: 'https://p2100.net/api.php/provide/vod',
		name: 'p2100资源',
	},
	soubo: {
		api: 'https://subocaiji.com/api.php/provide/vod',
		name: '搜播资源',
	},
	feifanziyuan: {
		api: 'http://cj.ffzyapi.com/api.php/provide/vod',
		name: '非凡资源',
	},
	uku: {
		api: 'https://api.ukuapi.com/api.php/provide/vod',
		name: 'U酷资源',
	},
	qilin: {
		api: 'https://www.qilinzyz.com/api.php/provide/vod',
		name: '麒麟资源',
	},
	fqzy: {
		api: 'http://api.fqzy.cc/api.php/provide/vod',
		name: '番茄资源',
	},
	hongniu1: {
		api: 'https://www.hongniuzy1.com/inc/api.php',
		name: '红牛资源',
	},
	kuaibo: {
		api: 'http://www.kuaibozy.com/api.php/provide/vod/from/kbm3u8',
		name: '快播资源',
	},
	'8090': {
		api: 'http://zy.yilans.net:8090/api.php/provide/vod',
		name: '8090资源',
	},
	hongniu2: {
		api: 'http://hongniuzy2.com/api.php/provide/vod/from/hnm3u8',
		name: '红牛2',
	},
	'1080zyku': {
		api: 'http://api.1080zyku.com/inc/api.php/provide/vod',
		name: '1080影库',
	},
	'39kan': {
		api: 'http://39kan.com/api.php/provide/vod',
		name: '39影视',
	},
	vipmv: {
		api: 'http://vipmv.cc/api.php/provide/vod',
		name: '天堂资源',
	},
	lehootv: {
		api: 'http://lehootv.com/api.php/provide/vod',
		name: '乐活影视',
	},
	tangrenjie: {
		api: 'http://tangrenjie.tv/api.php/provide/vod',
		name: '唐人街',
	},
	kuapi: {
		api: 'http://api.kuapi.cc/api.php/provide/vod',
		name: '酷影视',
	},
	kudian: {
		api: 'http://kudian10.com/api.php/provide/vod',
		name: '酷点',
	},
	slapibf: {
		api: 'http://slapibf.com/api.php/provide/vod',
		name: 'SL资源',
	},
	ykapi: {
		api: 'http://api.ykapi.net/api.php/provide/vod',
		name: '影客',
	},
	kczy: {
		api: 'http://caiji.kczyapi.com/api.php/provide/vod/from/kcm3u8',
		name: '快船',
	},
	apittzy: {
		api: 'http://apittzy.com/api.php/provide/vod',
		name: '天天',
	},
	sdzy: {
		api: 'http://sdzyapi.com/api.php/provide/vod/from/sdm3u8',
		name: '闪电',
	},
	aosika: {
		api: 'http://aosikazy.com/api.php/provide/vod',
		name: '傲视卡',
	},
	apilyzy: {
		api: 'http://api.apilyzy.com/api.php/provide/vod',
		name: '艾丽',
	},
	bdxzy: {
		api: 'http://m3u8.bdxzyapi.com/api.php/provide/vod',
		name: '闪电B站',
	},
	lovedan: {
		api: 'http://lovedan.net/api.php/provide/vod',
		name: '爱蛋',
	},
	zzrhgg: {
		api: 'http://www.zzrhgg.com/api.php/provide/vod',
		name: 'zzrhgg',
	},
	tiankong: {
		api: 'http://m3u8.tiankongapi.com/api.php/provide/vod/from/tkm3u8',
		name: '天空m3u8',
	},
	haiwaikan: {
		api: 'https://haiwaikan.com/api.php/provide/vod',
		name: '海外看',
	},
	heimuer: {
		api: 'https://www.heimuer.tv/api.php/provide/vod',
		name: '黑木耳',
	},
	cttvys: {
		api: 'http://ys9.cttv.vip/api.php/provide/vod',
		name: 'CTTV-Y',
	},
	cttvgwc: {
		api: 'http://gwcms.cttv.vip/api.php/provide/vod',
		name: 'CTTV-G',
	},
	yyff: {
		api: 'https://yyff.540734621.xyz/api.php/provide/vod',
		name: 'yyff',
	},
	hw8: {
		api: 'https://hw8.live/api.php/provide/vod',
		name: 'hw8',
	},
	xiaohuangren: {
		api: 'https://iqyi.xiaohuangrentv.com/api.php/provide/vod',
		name: '小黄人',
	},
	niuniu: {
		api: 'https://api.niuniuzy.me/api.php/provide/vod',
		name: '牛牛',
	},
	yayazy: {
		api: 'https://cj.yayazy.net/api.php/provide/vod',
		name: '鸭鸭',
	},
	'49zyw': {
		api: 'https://49zyw.com/api.php/provide/vod',
		name: '49资源',
	},
	suoni: {
		api: 'https://suoniapi.com/api.php/provide/vod',
		name: '索尼',
	},
	ikun: {
		api: 'https://ikunzyapi.com/api.php/provide/vod',
		name: 'IKUN',
	},
	feisuapi: {
		api: 'https://www.feisuzyapi.com/api.php/provide/vod',
		name: '飞速API',
	},
	kuaikan: {
		api: 'https://www.kuaikan-api.com/api.php/provide/vod',
		name: '快看',
	},
	xzcjz: {
		api: 'https://xzcjz.com/api.php/provide/vod',
		name: 'xzcjz',
	},
	ahjiuman: {
		api: 'https://www.ahjiuman.com/api.php/provide/vod/at/json',
		name: '阿鸡漫',
	},
	moduapi: {
		api: 'https://caiji.moduapi.cc/api.php/provide/vod',
		name: '蘑菇',
	},
	qhzy: {
		api: 'https://caiji.qhzyapi.com/api.php/provide/vod',
		name: '奇虎',
	},
	kuaiyun: {
		api: 'https://www.kuaiyunzy.com/api.php/provide/vod',
		name: '快云',
	}
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
