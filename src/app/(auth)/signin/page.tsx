import { redirect } from 'next/navigation';

export default function SignInPage() {
  // Single entry: forward any /signin traffic to splash
  redirect('/splash');
}
