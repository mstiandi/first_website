/* 精神避难所 — 认证模块（Supabase Magic Link） */
var AuthSystem = (function () {
  var supabase = null;
  var session = null;
  var inited = false;

  // ═══ 配置（部署前替换为你的 Supabase 项目信息）═══
  var SUPABASE_URL = 'https://bpujrefogjwpozdajejo.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdWpyZWZvZ2p3cG96ZGFqZWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDI3MzUsImV4cCI6MjA5NDU3ODczNX0.6_OO4Ru6QevE9VJ8GrP9BfuyKz4-sQk6uJoBItc03V4';

  // ── UI 元素 ──
  var authPanel = null;

  function init() {
    if (inited) return;
    inited = true;

    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('Auth: Supabase SDK not loaded');
      return;
    }

    // 恢复已有 session
    supabase.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        session = res.data.session;
      }
    });

    // 监听 session 变化
    supabase.auth.onAuthStateChange(function (event, newSession) {
      session = newSession;
      if (event === 'SIGNED_IN' && newSession) {
        hideLoginPrompt();
        // 登录成功后恢复聊天
        if (typeof ChatSystem !== 'undefined' && ChatSystem.isActive()) {
          // 重置 guest 计数，允许继续发消息
        }
      }
    });

    // 处理 magic link 回调（URL hash 中的 access_token）
    handleMagicLinkCallback();
  }

  function handleMagicLinkCallback() {
    var hash = window.location.hash;
    if (!hash || hash.indexOf('access_token') === -1) return;

    var params = {};
    var parts = hash.substring(1).split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    }

    if (params.access_token && params.refresh_token) {
      supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token
      }).then(function (res) {
        if (!res.error) {
          session = res.data.session;
          window.location.hash = '';
        }
      });
    }
  }

  function getSession() {
    return session;
  }

  function getUserId() {
    return session ? session.user.id : null;
  }

  function getAccessToken() {
    return session ? session.access_token : null;
  }

  function getGuestId() {
    var id = localStorage.getItem('sanctuary_guest_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('sanctuary_guest_id', id);
    }
    return id;
  }

  // ── 登录面板 ──
  function showLoginPrompt() {
    if (authPanel) return; // 已显示

    authPanel = document.createElement('div');
    authPanel.className = 'auth-panel';
    authPanel.innerHTML =
      '<div class="auth-title">想让我记住你吗？</div>' +
      '<div class="auth-subtitle">登录后可以和静静一直聊下去，她会慢慢了解你</div>' +
      '<input type="email" class="auth-input" placeholder="输入邮箱" autocomplete="email">' +
      '<button class="auth-btn">发送登录链接</button>' +
      '<div class="auth-msg"></div>' +
      '<div class="auth-dismiss">以后再说</div>';

    var input = authPanel.querySelector('.auth-input');
    var btn = authPanel.querySelector('.auth-btn');
    var msg = authPanel.querySelector('.auth-msg');
    var dismiss = authPanel.querySelector('.auth-dismiss');

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var email = input.value.trim();
      if (!email || email.indexOf('@') === -1) {
        msg.textContent = '请输入有效的邮箱地址';
        return;
      }
      btn.disabled = true;
      btn.textContent = '发送中...';
      msg.textContent = '';

      supabase.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: true }
      }).then(function (res) {
        if (res.error) {
          msg.textContent = '发送失败，请稍后重试';
          btn.disabled = false;
          btn.textContent = '发送登录链接';
        } else {
          msg.textContent = '链接已发送，请查收邮件';
          btn.style.display = 'none';
        }
      });
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btn.click();
    });

    input.addEventListener('mousedown', function (e) { e.stopPropagation(); });

    dismiss.addEventListener('click', function (e) {
      e.stopPropagation();
      hideLoginPrompt();
    });

    authPanel.addEventListener('mousedown', function (e) {
      e.stopPropagation();
    });

    var overlay = document.getElementById('chat-overlay');
    if (overlay) overlay.appendChild(authPanel);

    // 延迟显示过渡
    setTimeout(function () {
      if (authPanel) authPanel.classList.add('open');
      if (input) input.focus();
    }, 100);
  }

  function hideLoginPrompt() {
    if (!authPanel) return;
    authPanel.classList.remove('open');
    setTimeout(function () {
      if (authPanel && authPanel.parentNode) {
        authPanel.parentNode.removeChild(authPanel);
      }
      authPanel = null;
    }, 250);
  }

  function signOut() {
    if (supabase) supabase.auth.signOut();
    session = null;
  }

  return {
    init: init,
    getSession: getSession,
    getUserId: getUserId,
    getAccessToken: getAccessToken,
    getGuestId: getGuestId,
    showLoginPrompt: showLoginPrompt,
    hideLoginPrompt: hideLoginPrompt,
    signOut: signOut
  };
})();
