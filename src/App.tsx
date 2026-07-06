import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import TargetCursor from './components/TargetCursor';
import Home from './pages/Home';
import Room from './pages/Room';

const CURSOR_TARGETS =
  'button:not(:disabled), .btn-toggle, .custom-select__trigger, .custom-select__option, .yt-ctrl-btn, a';

function AppShell() {
  const location = useLocation();

  return (
    <>
      <TargetCursor
        resetSignal={location.pathname}
        targetSelector={CURSOR_TARGETS}
        spinDuration={2}
        hideDefaultCursor
        parallaxOn={false}
        hoverDuration={0.7}
        cursorColor="#ffffff"
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room" element={<Room />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
