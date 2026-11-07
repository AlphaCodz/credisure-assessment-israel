import { ApiProvider } from "@/components/ApiProvider";
import "./globals.css";

export const metadata = {
  title: "Admin Dashboard",
  description: "Simple user management dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <ApiProvider>{children}</ApiProvider>
      </body>
    </html>
  );
}
