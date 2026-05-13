import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";

// Body — Inter
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

// Mono — for IDs and AED figures
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Q Tax · Tax Intelligence Studio",
  description:
    "AI agents that audit a tax administration against the IMF TADAT framework — UAE Federal Tax Authority POC.",
};

// Pre-hydration theme script — reads localStorage("theme"), defaults to dark,
// applies `.dark` class before paint to prevent FOUC.
const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
} catch (e) {
  document.documentElement.classList.add('dark');
}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-indigo-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>
        <WorkspaceProvider>
          <div id="main">{children}</div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
