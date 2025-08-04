import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from '../../models/user.model';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
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
    console.error('Failed to create Supabase user:', error.message);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await User.create({
    name,
    email,
    password: hashedPassword,
    role: 'admin',
    status: 'active',
    stripeCustomerId: null,
    SubscriptionStatus: 'Free',
    planId: null,
    resetTokenExpiry: null,
  });

  console.log('Admin user created successfully:', data.user?.email);
}
