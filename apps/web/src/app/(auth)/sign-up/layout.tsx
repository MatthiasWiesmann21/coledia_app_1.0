import { redirectIfSignedIn } from "@/lib/redirect-if-signed-in";

export default async function SignUpLayout({ children }: { children: React.ReactNode }) {
  await redirectIfSignedIn();
  return children;
}
