/* WeChat API 工具 — access_token 管理 + 内容安全 */

var cachedToken = null;
var tokenExpiry = 0;

var WX_APPID = process.env.WX_APPID || '';
var WX_SECRET = process.env.WX_SECRET || '';

async function getAccessToken() {
  var now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  if (!WX_APPID || !WX_SECRET) return null;

  try {
    var resp = await fetch(
      'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + WX_APPID + '&secret=' + WX_SECRET
    );
    var data = await resp.json();
    if (data.access_token) {
      cachedToken = data.access_token;
      tokenExpiry = now + (data.expires_in - 300) * 1000; // 提前 5 分钟刷新
      return cachedToken;
    }
    console.error('WeChat token error:', data);
    return null;
  } catch (e) {
    console.error('WeChat token fetch error:', e);
    return null;
  }
}

/**
 * 微信内容安全检测
 * @returns { pass: boolean, reason?: string }
 */
async function checkContent(content, openid) {
  if (!content || !content.trim()) return { pass: true };

  // 无 openid 时跳过内容安全检测（非微信用户或本地调试场景）
  if (!openid) {
    console.warn('msgSecCheck skipped: no openid');
    return { pass: true };
  }

  var token = await getAccessToken();
  if (!token) {
    // 无 token 时放行（避免阻塞正常使用），但记日志
    console.warn('msgSecCheck skipped: no access_token');
    return { pass: true };
  }

  try {
    var body = {
      content: content.substring(0, 500),
      version: 2,
      scene: 2,  // 评论场景
      openid: openid || ''
    };

    var resp = await fetch(
      'https://api.weixin.qq.com/wxa/msg_sec_check?access_token=' + token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    var data = await resp.json();

    if (data.errcode === 0 && data.result && data.result.suggest === 'pass') {
      return { pass: true };
    }

    console.warn('msgSecCheck flagged:', JSON.stringify(data));
    return { pass: false, reason: 'content_blocked' };
  } catch (e) {
    console.error('msgSecCheck error:', e);
    return { pass: true }; // 异常时放行
  }
}

export { checkContent, getAccessToken };
