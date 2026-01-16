/**
 * 检查同步码是否已存在
 * POST /api/sync/check
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { syncCode } = await request.json();

        if (!syncCode || syncCode.length < 4) {
            return new Response(JSON.stringify({ error: '同步码格式错误' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 检查 KV 中是否存在该同步码
        const exists = await env.LIBRETV_SYNC.get(syncCode);

        return new Response(JSON.stringify({ exists: !!exists }), {
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
