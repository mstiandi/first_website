const { chromium } = require('playwright');

(async () => {
  const userDataDir = 'C:/Users/Ms/AppData/Local/Temp/playwright_profile';
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false
  });

  const page = context.pages()[0] || await context.newPage();
  const projectRef = 'bpujrefogjwpozdajejo';

  // Go to project settings → API
  console.log('→ 打开项目设置...');
  await page.goto('https://supabase.com/dashboard/project/' + projectRef + '/settings/api', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await page.waitForTimeout(4000);

  // If redirected, look for "Data API" in sidebar and click Settings tab
  let currentUrl = page.url();
  console.log('URL:', currentUrl);

  // Try clicking "Settings" tab if on Data API page
  const settingsTab = page.locator('button:has-text("Settings"), a:has-text("Settings"), [role="tab"]:has-text("Settings")').first();
  const overviewTab = page.locator('button:has-text("Overview"), a:has-text("Overview"), [role="tab"]:has-text("Overview")').first();

  const settingsVisible = await settingsTab.isVisible({ timeout: 2000 }).catch(() => false);
  if (settingsVisible) {
    console.log('→ 点击 Settings tab...');
    await settingsTab.click();
    await page.waitForTimeout(3000);
    console.log('URL after:', page.url());
  }

  const text = await page.locator('body').innerText().catch(() => '');
  console.log('\nPage text:', text.substring(0, 2000));

  // Also try to extract any API keys or URLs
  // Look for patterns like "https://*.supabase.co"
  const urlMatch = text.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
  if (urlMatch) console.log('\nFound URL:', urlMatch[0]);

  // Check for "anon" or "service_role" or "public" keys
  if (text.includes('anon') || text.includes('service_role') || text.includes('public')) {
    console.log('\n✓ 页面包含密钥信息');
  }

  // Also try the Connect page which might show keys
  if (!text.includes('anon') && !text.includes('API URL')) {
    console.log('\n→ 尝试 Connect 页面...');
    await page.goto('https://supabase.com/dashboard/project/' + projectRef + '/connect', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(4000);
    const text2 = await page.locator('body').innerText().catch(() => '');
    console.log('Connect page:', text2.substring(0, 1500));
  }

  await page.screenshot({ path: 'D:/websites/just_me/tools/screen.png' });
  console.log('\n截图已保存。看看浏览器显示了什么关键信息？');

  process.stdin.resume();
  await new Promise(() => {});
})();
