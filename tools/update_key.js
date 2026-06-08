// 更换密钥（保留原有数据）
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bpujrefogjwpozdajejo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdWpyZWZvZ2p3cG96ZGFqZWpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTAwMjczNSwiZXhwIjoyMDk0NTc4NzM1fQ.fkd6_aKOHVOp49cf23qHzX3_5Dg1z3ZkFFlHoTYWC2I'
);

function emailFromKey(key) {
  return 'key-' + Buffer.from(key).toString('base64').substring(0, 8) + '@jingshen.internal';
}

async function main() {
  var oldKey = process.argv[2];
  var newKey = process.argv[3];

  if (!oldKey || !newKey) {
    console.log('Usage: node update_key.js <old-key> <new-key>');
    process.exit(1);
  }

  var oldEmail = emailFromKey(oldKey);

  // Find the user by old email
  var { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error('List error:', error.message); process.exit(1); }

  var user = users.users.find(function (u) { return u.email === oldEmail; });
  if (!user) {
    console.log('未找到旧密钥对应的用户');
    console.log('尝试创建新用户...');

    var { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: emailFromKey(newKey),
      password: newKey,
      email_confirm: true,
      user_metadata: { login_type: 'key' }
    });
    if (createErr) { console.error('Create error:', createErr.message); process.exit(1); }
    console.log('✓ 新密钥已创建: ' + newKey);
    console.log('  User ID: ' + newUser.user.id);
    process.exit(0);
  }

  console.log('找到用户: ' + user.id);
  console.log('旧密钥: ' + oldKey);
  console.log('新密钥: ' + newKey);

  // Update email and password
  var newEmail = emailFromKey(newKey);
  var { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
    user.id,
    { email: newEmail, password: newKey }
  );

  if (updateErr) { console.error('Update error:', updateErr.message); process.exit(1); }

  console.log('✓ 密钥已更换');
  console.log('  旧: ' + oldKey + ' (已失效)');
  console.log('  新: ' + newKey + ' (唯一有效)');
  console.log('  所有历史数据保留');
}

main();
