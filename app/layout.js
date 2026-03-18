import "./globals.css";

export const metadata = {
  title: "Pokémon Battle Arena",
  description: "A fully featured Pokémon turn-based battle game built with Next.js",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
