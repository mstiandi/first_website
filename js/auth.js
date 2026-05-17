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
  var authBtn = null;

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
      updateAuthButton();
      if (event === 'SIGNED_IN' && newSession) {
        hideLoginPrompt();
      }
    });

    // 处理 magic link 回调（URL hash 中的 access_token）
    handleMagicLinkCallback();

    // 创建登录按钮
    buildAuthButton();
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

  // ── 登录按钮（右上角）──
  function buildAuthButton() {
    authBtn = document.createElement('div');
    authBtn.className = 'auth-btn-icon';
    authBtn.title = '登录';
    updateAuthButtonIcon();
    authBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (session) {
        // 已登录：点一下弹出确认
        if (confirm('退出登录？')) signOut();
      } else {
        showLoginPrompt();
      }
    });
    var overlay = document.getElementById('chat-overlay');
    if (overlay) overlay.appendChild(authBtn);
  }

  function updateAuthButton() {
    if (!authBtn) return;
    updateAuthButtonIcon();
  }

  function updateAuthButtonIcon() {
    if (!authBtn) return;
    if (session) {
      authBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="8" r="4" fill="#40d068"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7" fill="none" stroke="#40d068" stroke-width="1.5"/></svg>';
      authBtn.title = '已登录 · 点击退出';
    } else {
      authBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="8" r="4" fill="none" stroke="#8ea4c0" stroke-width="1.5"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7" fill="none" stroke="#8ea4c0" stroke-width="1.5"/></svg>';
      authBtn.title = '登录';
    }
  }

  // ── 登录面板 ──
  var loginEmail = '';
  var loginPhase = 'email'; // 'email' | 'code'

  function showLoginPrompt() {
    if (authPanel) return;
    loginPhase = 'email';
    loginEmail = '';

    authPanel = document.createElement('div');
    authPanel.className = 'auth-panel';
    renderLoginPanel();

    authPanel.addEventListener('mousedown', function (e) {
      e.stopPropagation();
    });

    var overlay = document.getElementById('chat-overlay');
    if (overlay) overlay.appendChild(authPanel);

    setTimeout(function () {
      if (authPanel) {
        authPanel.classList.add('open');
        var input = authPanel.querySelector('.auth-input');
        if (input) input.focus();
      }
    }, 100);
  }

  function renderLoginPanel() {
    if (!authPanel) return;

    if (loginPhase === 'email') {
      authPanel.innerHTML =
        '<div class="auth-title">想让我记住你吗？</div>' +
        '<div class="auth-subtitle">登录后静静会慢慢了解你</div>' +
        '<input type="email" class="auth-input" placeholder="输入邮箱" autocomplete="email">' +
        '<button class="auth-btn">发送验证码</button>' +
        '<div class="auth-msg"></div>' +
        '<div class="auth-dismiss">以后再说</div>';
    } else {
      authPanel.innerHTML =
        '<div class="auth-title">输入验证码</div>' +
        '<div class="auth-subtitle">已发送至 ' + escapeHTML(loginEmail) + '</div>' +
        '<input type="text" class="auth-input auth-code-input" placeholder="6位验证码" maxlength="6" autocomplete="one-time-code" inputmode="numeric">' +
        '<button class="auth-btn">验证</button>' +
        '<div class="auth-msg"></div>' +
        '<div class="auth-dismiss">取消</div>';
    }

    bindLoginEvents();
  }

  function bindLoginEvents() {
    if (!authPanel) return;
    var input = authPanel.querySelector('.auth-input');
    var btn = authPanel.querySelector('.auth-btn');
    var msg = authPanel.querySelector('.auth-msg');
    var dismiss = authPanel.querySelector('.auth-dismiss');

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (loginPhase === 'email') {
        sendOTP(input, btn, msg);
      } else {
        verifyOTP(input, btn, msg);
      }
    });

    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') btn.click();
      });
      input.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    }

    dismiss.addEventListener('click', function (e) {
      e.stopPropagation();
      hideLoginPrompt();
    });
  }

  function sendOTP(input, btn, msg) {
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
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    }).then(function (res) {
      if (res.error) {
        msg.textContent = '发送失败：' + (res.error.message || '请稍后重试');
        btn.disabled = false;
        btn.textContent = '发送验证码';
      } else {
        loginEmail = email;
        loginPhase = 'code';
        renderLoginPanel();
        setTimeout(function () {
          if (authPanel) {
            var codeInput = authPanel.querySelector('.auth-code-input');
            if (codeInput) codeInput.focus();
          }
        }, 150);
      }
    });
  }

  function verifyOTP(input, btn, msg) {
    var code = input.value.trim();
    if (code.length < 6) {
      msg.textContent = '请输入6位验证码';
      return;
    }
    btn.disabled = true;
    btn.textContent = '验证中...';
    msg.textContent = '';

    supabase.auth.verifyOtp({
      email: loginEmail,
      token: code,
      type: 'email'
    }).then(function (res) {
      if (res.error) {
        msg.textContent = '验证码不正确或已过期';
        btn.disabled = false;
        btn.textContent = '验证';
      } else {
        // 登录成功，session 会通过 onAuthStateChange 更新
        hideLoginPrompt();
      }
    });
  }

  function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
