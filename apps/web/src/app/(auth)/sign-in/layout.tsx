import { redirectIfSignedIn } from "@/lib/redirect-if-signed-in";

export default async function SignInLayout({ children }: { children: React.ReactNode }) {
  await redirectIfSignedIn();
  return children;
}
