import { BrowserRouter } from "react-router-dom";
import { Providers } from "./providers";
import { AppRouter } from "./router";

const App = () => (
  <Providers>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </Providers>
);

export default App;

