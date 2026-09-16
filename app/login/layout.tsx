import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Sign In | J&J Practice Cloud",
  description: "Secure sign in for registered J&J Practice Cloud practices.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
