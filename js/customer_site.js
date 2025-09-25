const CUSTOMER_SITES = {
	niuniuziyuan: {
		api: 'https://api.niuniuzy.me/api.php/provide/vod',
		name: '牛牛视频',
	},
	zuidaziyuan: {
		api: 'http://zuidazy.me/api.php/provide/vod',
		name: '最大资源',
	}
};

// 调用全局方法合并
if (window.extendAPISites) {
    window.extendAPISites(CUSTOMER_SITES);
} else {
    console.error("错误：请先加载 config.js！");
}
