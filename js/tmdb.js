// TMDB 热播数据层：discover 接口请求 + 标签映射 + 字段提取
// 依赖（script 顺序）：config.js（PROXY_URL / TMDB_CONFIG）→ proxy-auth.js（window.ProxyAuth）→ 本文件
// 数据流：recent-watch.js 的 fetchDoubanSubjects → fetchTmdbSubjects → fetchTmdbData（代理）
// 返回与豆瓣 subjects 同构的原始数组 [{ title, rate, cover }]，由 recent-watch.js render 的
// .map 段统一归一化（rate 0/0.0 → 空串）并 buildCoverUrl。

const TMDB_PAGE_LIMIT = 10; // 每批展示条数：TMDB v3 每页固定 20 条，前端截断前 10 条保持原"每批 10 条"体验

// 标签 → discover 查询参数映射（无映射标签退化为热门）
// 语义：华语按语言（with_original_language），其余地区按制作国（with_origin_country）；genre id 为 TMDB 标准 id
const TMDB_TAG_TO_QUERY = {
    movie: {
        '热门': { sort_by: 'popularity.desc' },
        '最新': { sort_by: 'primary_release_date.desc' },
        '经典': { sort_by: 'vote_average.desc', vote_count_gte: 200 },
        '豆瓣高分': { sort_by: 'vote_average.desc', vote_count_gte: 50 },
        '华语': { with_original_language: 'zh' },
        '欧美': { with_origin_country: 'US,GB,FR,DE,ES,IT' },
        '韩国': { with_origin_country: 'KR' },
        '日本': { with_origin_country: 'JP' },
        '动作': { with_genres: '28' },
        '喜剧': { with_genres: '35' },
        '爱情': { with_genres: '10749' },
        '科幻': { with_genres: '878' },
        '悬疑': { with_genres: '53' },
        '恐怖': { with_genres: '27' }
        // 冷门佳片 / 治愈 / 日综：无映射 → 退化为热门
    },
    tv: {
        '热门': { sort_by: 'popularity.desc' },
        '美剧': { with_origin_country: 'US' },
        '英剧': { with_origin_country: 'GB' },
        '韩剧': { with_origin_country: 'KR' },
        '日剧': { with_origin_country: 'JP' },
        '国产剧': { with_origin_country: 'CN' },
        '港剧': { with_origin_country: 'HK' },
        '日本动画': { with_genres: '16', with_original_language: 'ja' },
        '综艺': { with_genres: '10764' },
        '纪录片': { with_genres: '99' }
    }
};

// 通过代理拉取 TMDB 数据（10s 超时 + ProxyAuth 鉴权 + allorigins 备用）
async function fetchTmdbData(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl
            ? await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(url))
            : PROXY_URL + encodeURIComponent(url);

        const response = await fetch(proxiedUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error("TMDB API 请求失败（直接代理）：", err);

        try {
            const fallbackResponse = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            if (!fallbackResponse.ok) {
                throw new Error(`备用API请求失败! 状态: ${fallbackResponse.status}`);
            }
            const data = await fallbackResponse.json();
            if (data && data.contents) {
                return JSON.parse(data.contents);
            }
            throw new Error("无法获取有效数据");
        } catch (fallbackErr) {
            console.error("TMDB API 备用请求也失败：", fallbackErr);
            throw fallbackErr;
        }
    }
}

// 标签映射解析：无映射标签退化为热门（该类型下）
function resolveTagQuery(type, tag) {
    const map = (TMDB_TAG_TO_QUERY[type] || {})[tag];
    return map || TMDB_TAG_TO_QUERY[type]['热门'] || { sort_by: 'popularity.desc' };
}

// 拉取 TMDB 热播数据；type: 'movie'|'tv'，tag: 标签，year: 年份（空 = 全部），page: 页码（1 基）
// 返回与豆瓣 subjects 同构的原始数组 [{ title, rate, cover }]
async function fetchTmdbSubjects(type, tag, year, page) {
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    // page 为 TMDB 1 基页码；显式校验（>0 才用），避免 0/负数被静默规约掩盖调用方语义错误
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const params = new URLSearchParams({
        api_key: TMDB_CONFIG.apiKey,
        page: String(pageNum)
    });

    const query = resolveTagQuery(type, tag);
    Object.entries(query).forEach(([key, value]) => {
        if (key === 'vote_count_gte') params.set('vote_count.gte', String(value));
        else params.set(key, String(value));
    });

    // 年份：仅非空才拼参数（空 = 全部年份，保持请求 URL 简洁）
    if (year) {
        params.set(endpoint === 'tv' ? 'first_air_date_year' : 'primary_release_year', String(year));
    }

    const target = `https://api.themoviedb.org/3/discover/${endpoint}?${params.toString()}`;
    const data = await fetchTmdbData(target);
    const results = (data && data.results) || [];

    return results.slice(0, TMDB_PAGE_LIMIT).map((item) => ({
        title: String(item.original_title || item.title || item.original_name || item.name || '未知影片'),
        rate: String(item.vote_average || ''),
        cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : ''
    }));
}

// 暴露全局供 recent-watch.js 使用（无模块加载，全局即依赖契约）
window.fetchTmdbSubjects = fetchTmdbSubjects;
