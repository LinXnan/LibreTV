/**
 * 获取同步数据
 * GET /api/sync/data?syncCode=xxx
 */
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const syncCode = url.searchParams.get('syncCode');

    if (!syncCode) {
        return new Response(JSON.stringify({ error: '缺少同步码' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const data = await env.LIBRETV_SYNC.get(syncCode);

        if (!data) {
            return new Response(JSON.stringify({ error: '同步码不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(data, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: '服务器错误' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * 保存同步数据
 * POST /api/sync/data
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { syncCode, data } = await request.json();

        if (!syncCode || !data) {
            return new Response(JSON.stringify({ error: '参数错误' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 保存到 KV，设置过期时间为 1 年
        await env.LIBRETV_SYNC.put(syncCode, JSON.stringify(data), {
            expirationTtl: 31536000
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: '服务器错误' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
