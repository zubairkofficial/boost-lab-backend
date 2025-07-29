import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export async function seedAdmin() {
  const email = 'admin@gmail.com';
  const password = 'Admin@123';
  const name = 'Super Admin';

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role: 'admin',
    },
  });

  if (error) {
    console.error('❌ Failed to create admin:', error.message);
  } else {
    console.log('✅ Admin user created successfully:', data.user?.email);
  }
}
