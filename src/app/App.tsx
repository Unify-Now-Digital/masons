import { BrowserRouter } from "react-router-dom";
import { Providers } from "./providers";
import { AppRouter } from "./router";
import { ReviewNavToolbar } from "./layout/ReviewNavToolbar";
import { AdminProvider } from "./layout/AdminContext";
import { SidebarLayoutProvider, useSidebarLayout } from "./layout/SidebarLayoutContext";

function AppContent() {
  const { collapsed } = useSidebarLayout();
  return (
    <>
      <ReviewNavToolbar />
      <main
        className={`flex-1 min-w-0 min-h-screen w-full transition-[padding] duration-200 ${
          collapsed ? "md:pl-10" : "md:pl-[140px]"
        }`}
      >
        <AppRouter />
      </main>
    </>
  );
}

const App = () => (
  <Providers>
    <BrowserRouter>
      <AdminProvider>
        <SidebarLayoutProvider>
          <div className="flex min-h-screen w-full">
            <AppContent />
          </div>
        </SidebarLayoutProvider>
      </AdminProvider>
    </BrowserRouter>
  </Providers>
);

export default App;
