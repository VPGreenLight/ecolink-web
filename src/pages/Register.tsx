import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import AuthForm from "@/components/AuthForm"

export default function Register() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/")
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [navigate])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Tạo tài khoản EcoLink"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) navigate("/")
      }}
    >
      <div className="my-auto w-full max-w-[420px]">
        <AuthForm mode="register" />
      </div>
    </div>
  )
}
