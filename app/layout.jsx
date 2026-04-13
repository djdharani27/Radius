import { LocationProvider } from "@/context/LocationContext";
import { ChatNotificationProvider } from "@/context/ChatNotificationContext";
import RadarToggle from "@/components/RadarToggle";
import "./globals.css";

export const metadata = {
  title: "Radius",
  description: "Real-time proximity network for professionals",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LocationProvider>
          <ChatNotificationProvider>
            {children}
            <RadarToggle />
          </ChatNotificationProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
