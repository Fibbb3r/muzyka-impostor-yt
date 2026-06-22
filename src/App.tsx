import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EqualizerBackground from './components/EqualizerBackground';
import Home from './pages/Home';
import Room from './pages/Room';

export default function App() {
  return (
    <>
      <EqualizerBackground />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room" element={<Room />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
