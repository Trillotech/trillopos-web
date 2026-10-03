import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Noto_Sans_Myanmar } from "next/font/google";
import { headers } from "next/headers";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

// page titles and the big figures: optical sizes give large numbers their display cut
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
});

const myanmar = Noto_Sans_Myanmar({
  subsets: ["myanmar"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-myanmar",
});

export const metadata: Metadata = {
  title: "TrilloPOS",
  description: "TrilloPOS — sales, stock and money for your shop, by Trillotech",
};

/**
 * Runs before anything else, in old-style JavaScript on purpose, so it works on the phones where the
 * app's own files are slow or fail:
 * - A form without an `action` only works through the app's script. Tapped before the script has
 *   taken over, the browser would send it itself: a GET to the same page, with every field (a
 *   password too) in the address. That is stopped; sign-in and sign-up have an action and still go.
 * - Browser errors go to /api/client-errors (at most five per page), except the requests Safari
 *   drops when the page moves on ("Load failed", "access control checks"), which break nothing.
 * - Safari before iOS 15.4 has no crypto.randomUUID, which the screens use for the keys that make
 *   a retried sale or payment count once: one is made from crypto.getRandomValues (a version-4 UUID).
 */
const reportErrors = `(function(){var c=window.crypto;if(c&&c.getRandomValues&&!c.randomUUID){c.randomUUID=function(){var b=c.getRandomValues(new Uint8Array(16)),h=[],i;b[6]=b[6]&15|64;b[8]=b[8]&63|128;for(i=0;i<16;i++)h.push((b[i]+256).toString(16).slice(1));return h.slice(0,4).join("")+"-"+h.slice(4,6).join("")+"-"+h.slice(6,8).join("")+"-"+h.slice(8,10).join("")+"-"+h.slice(10).join("")}}document.addEventListener("submit",function(e){var f=e.target;if(f&&f.tagName==="FORM"&&!f.getAttribute("action"))e.preventDefault()},true);var n=0;function send(d){if(n>=5||/Load failed|access control checks/.test(d.message||""))return;n++;try{d.path=location.pathname;d.ua=navigator.userAgent;var b=JSON.stringify(d);if(navigator.sendBeacon){navigator.sendBeacon("/api/client-errors",new Blob([b],{type:"application/json"}))}else{var x=new XMLHttpRequest();x.open("POST","/api/client-errors");x.setRequestHeader("Content-Type","application/json");x.send(b)}}catch(e){}}
window.addEventListener("error",function(e){var t=e.target;if(t&&t!==window&&(t.src||t.href)){send({kind:"load",message:"could not load",source:String(t.src||t.href)});return}send({kind:"error",message:String(e.message||""),source:String(e.filename||""),line:e.lineno||0,col:e.colno||0})},true);
window.addEventListener("unhandledrejection",function(e){var r=e.reason;send({kind:"rejection",message:String((r&&r.message)||r||"")})})})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = (await headers()).get("x-next-intl-locale") ?? "en";
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} ${myanmar.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: reportErrors }} />
      </head>
      <body className="min-h-full bg-surface text-ink">{children}</body>
    </html>
  );
}
