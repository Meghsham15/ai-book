import type { Metadata } from "next";
import { Literata, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--font-sans-face",
  subsets: ["latin"],
});

const display = Literata({
  variable: "--font-display-face",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Book",
    template: "%s · AI Book",
  },
  description: "A research partner for one shared library. Ask your files, pages, and notes, and check every answer against the passage it came from.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full font-sans text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ai-book-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
