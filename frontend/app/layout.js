import "./globals.css";

export const metadata = {
  title: "Hotel Voice Assistant",
  description: "Hotel reservation voice bot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
