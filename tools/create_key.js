// 创建密钥用户（一次性脚本）
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bpujrefogjwpozdajejo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdWpyZWZvZ2p3cG96ZGFqZWpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTAwMjczNSwiZXhwIjoyMDk0NTc4NzM1fQ.fkd6_aKOHVOp49cf23qHzX3_5Dg1z3ZkFFlHoTYWC2I'
);

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.log('Usage: node create_key.js <your-secret-key>');
    console.log('Example: node create_key.js jingshen-2026-moon');
    process.exit(1);
  }

  const email = 'key-' + Buffer.from(key).toString('base64').substring(0, 8) + '@jingshen.internal';

  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: key,
    email_confirm: true,
    user_metadata: { login_type: 'key' }
  });

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('✓ 密钥用户已创建');
  console.log('  密钥: ' + key);
  console.log('  User ID: ' + data.user.id);
  console.log('');
  console.log('请记住你的密钥: ' + key);
  console.log('登录时选择"密钥登录"，输入此密钥即可。');
}

main();
