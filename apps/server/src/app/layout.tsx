// import './global.css'; // Disabled for API-only server

export const metadata = {
  title: 'Leveza API',
  description: 'The API powering Leveza.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
