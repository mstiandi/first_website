const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('→ 打开 Supabase 首页...');
  await page.goto('https://supabase.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  console.log('→ 点击 Sign in...');
  const signInLinks = page.locator('a[href*="sign-in"], a:has-text("Sign in")');
  if (await signInLinks.count() > 0) {
    await signInLinks.first().click();
    console.log('  已点击');
  } else {
    console.log('  未找到 Sign in 按钮，可能已经在登录页');
    await page.goto('https://supabase.com/dashboard/sign-in', { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(2000);

  console.log('→ 点击 Continue with GitHub...');
  const githubBtn = page.locator('button:has-text("GitHub")');
  if (await githubBtn.count() > 0) {
    await githubBtn.first().click();
    console.log('  已点击，等待 GitHub 授权...');
  } else {
    console.log('  未找到 GitHub 按钮，检查页面状态...');
  }

  console.log('');
  console.log('=== 请在浏览器中完成 GitHub 登录授权 ===');
  console.log('登录完成后浏览器会自动跳转到 Dashboard');
  console.log('');

  // Wait for dashboard
  await page.waitForURL('**/dashboard/**', { timeout: 180000 }).then(() => {
    console.log('✓ 已进入 Dashboard');
  }).catch(() => {
    console.log('超时，请手动确认是否已登录');
  });

  await page.waitForTimeout(2000);

  // Try to create new project
  console.log('→ 寻找 "New project" 按钮...');
  const newProject = page.locator('a[href*="new-project"], button:has-text("New project"), a:has-text("New project")');
  if (await newProject.count() > 0) {
    await newProject.first().click();
    console.log('  已点击');
  } else {
    console.log('  未找到，尝试跳转...');
    await page.goto('https://supabase.com/dashboard/new-project', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }

  console.log('');
  console.log('=== 请填写以下信息 ===');
  console.log('项目名: jingshen-sanctuary');
  console.log('Database Password: 设置一个强密码并记住');
  console.log('Region: ap-southeast-1 (Singapore)');
  console.log('');
  console.log('填写完成后告诉我，我来拿密钥');
  console.log('浏览器窗口保持打开，不要关闭');
  console.log('');

  // Keep alive
  process.stdin.resume();
  await new Promise(() => {});
})();
