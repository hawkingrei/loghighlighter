import "./globals.css";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Script from "next/script";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "LogHighlighter",
  description: "Regex-powered log highlighting with local persistence.",
};

const installTriggerShim = `
(function () {
  try {
    delete window.InstallTrigger;
    Object.defineProperty(window, "InstallTrigger", {
      configurable: true,
      enumerable: false,
      get: function () {
        return undefined;
      },
      set: function () {},
    });
  } catch (error) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script id="installtrigger-shim" strategy="beforeInteractive">
          {installTriggerShim}
        </Script>
      </head>
      <body className={`${spaceGrotesk.variable} ${jetBrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
