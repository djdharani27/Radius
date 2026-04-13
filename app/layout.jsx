import { LocationProvider } from "@/context/LocationContext";
import "./globals.css";

export const metadata = {
  title: "EntreRadar",
  description: "Proximity network for entrepreneurs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LocationProvider>
          {children}
        </LocationProvider>
      </body>
    </html>
  );
}