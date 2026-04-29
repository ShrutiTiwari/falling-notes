import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PianoVisualizer from "./components/PianoVisualizer";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PianoVisualizer />} />
        <Route path="/:piece" element={<PianoVisualizer />} />
        {/* Catch-all: redirect unknown paths to default piece */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
