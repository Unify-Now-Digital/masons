import { BrowserRouter } from "react-router-dom";
import { Providers } from "./providers";
import { AppRouter } from "./router";
import { ReviewNavToolbar } from "./layout/ReviewNavToolbar";

const App = () => (
  <Providers>
    <BrowserRouter>
      <ReviewNavToolbar />
      <div className="md:pl-[140px]">
        <AppRouter />
      </div>
    </BrowserRouter>
  </Providers>
);

export default App;

