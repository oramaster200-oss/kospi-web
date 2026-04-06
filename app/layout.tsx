import "./globals.css";

export const metadata = {
  title: "KOSPI AI Insight",
  description: "AI-powered KOSPI stock price prediction dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
