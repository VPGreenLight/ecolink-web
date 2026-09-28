import { BrowserRouter, Route, Routes } from "react-router-dom"
import Layout from "@/components/Layout"
import Home from "@/pages/Home"
import Blog from "@/pages/Blog"
import Rewards from "@/pages/Rewards"
import Scanner from "@/pages/Scanner"
import MapPage from "@/pages/MapPage"
import Partners from "@/pages/Partners"
import Feedback from "@/pages/Feedback"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import NotFound from "@/pages/NotFound"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* auth pages own the whole screen — no nav, no footer */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="blog" element={<Blog />} />
          <Route path="rewards" element={<Rewards />} />
          <Route path="scanner" element={<Scanner />} />
          <Route path="map" element={<MapPage />} />
          <Route path="partners" element={<Partners />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
