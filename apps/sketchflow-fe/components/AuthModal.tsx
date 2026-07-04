"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { httpapiClient } from "../lib/apiClient";
import { Eye,EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AuthModalProps {
  mode: "signup" | "signin";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthModal({
  mode,
  open,
  onOpenChange,
}: AuthModalProps) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [viewPassword, setViewPassword] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    if (!open) {
      setMessage(null);
      setFormData({ username: "", email: "", password: "" });
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const url = `${mode === "signup" ? "/signup" : "/signin"}`;
      const payload =
        mode === "signup"
          ? {
              username: formData.username,
              email: formData.email,
              password: formData.password,
            }
          : { email: formData.email, password: formData.password };

      const res = await httpapiClient.post(url, payload);

      if (res.status == 200) {
        setMessage({ type: "success", text: res.data.message || "Success!" });
        console.log(76,res);
        login(res.data.token);
        if (mode == "signin") setTimeout(() => router.push("/dashboard"), 1500);
        else setTimeout(() => router.push("/dashboard"), 1500);
      }
    } catch (err: any) {
      console.log(err);
      if (err.response) {
        setMessage({
          type: "error",
          text: err.response.data.message || "Network error. Try again.",
        });
      } else {
        setMessage({ type: "error", text: "Network error. Try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[hsl(220_20%_14%/0.6)] backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-[hsl(40_15%_88%)] 
                   bg-[hsl(0_0%_100%)] p-8 shadow-2xl shadow-black/10 
                   animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center 
                     rounded-lg text-[hsl(220_10%_46%)] 
                     hover:text-[hsl(220_20%_14%)] hover:bg-[hsl(40_20%_93%)] transition-colors"
        >
          ✕
        </button>

        {/* Header */}
        <h2 className="text-2xl font-bold text-[hsl(220_20%_14%)]">
          {mode === "signup" ? "Create Account" : "Welcome Back"}
        </h2>

        <p className="mt-1 text-sm text-[hsl(220_10%_46%)]">
          {mode === "signup"
            ? "Sign up to start sketching and collaborating."
            : "Sign in to your Sketchflow account."}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[hsl(220_20%_14%)]">
                Username
              </label>
              <input
                name="username"
                type="text"
                required
                disabled={loading}
                value={formData.username}
                onChange={handleChange}
                placeholder="Your username"
                className="h-10 w-full rounded-md border border-[hsl(40_15%_88%)]
                           bg-[hsl(40_33%_98%)] px-3 text-sm
                           placeholder:text-[hsl(220_10%_46%)]
                           focus:outline-none focus:ring-2 
                           focus:ring-[hsl(12_80%_58%)]
                           disabled:opacity-50"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[hsl(220_20%_14%)]">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              disabled={loading}
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="h-10 w-full rounded-md border border-[hsl(40_15%_88%)]
                         bg-[hsl(40_33%_98%)] px-3 text-sm
                         placeholder:text-[hsl(220_10%_46%)]
                         focus:outline-none focus:ring-2 
                         focus:ring-[hsl(12_80%_58%)]
                         disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[hsl(220_20%_14%)]">
              Password
            </label>
            <input
              name="password"
              type={viewPassword ? "text" : "password"}
              required
              minLength={6}
              disabled={loading}
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="h-10 w-full rounded-md border border-[hsl(40_15%_88%)]
                         bg-[hsl(40_33%_98%)] px-3 text-sm
                         placeholder:text-[hsl(220_10%_46%)]
                         focus:outline-none focus:ring-2 
                         focus:ring-[hsl(12_80%_58%)]
                         disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setViewPassword(!viewPassword)}
              className="absolute right-10 bottom-26 -translate-y-1/2 text-gray-500 cursor-pointer"
            >
              {viewPassword ? <EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl cursor-pointer text-base font-medium
                       bg-[hsl(12_80%_58%)] text-white
                       shadow-lg shadow-[hsl(12_80%_58%/0.25)]
                       hover:shadow-xl hover:shadow-[hsl(12_80%_58%/0.35)]
                       hover:-translate-y-0.5 transition-all duration-300
                       disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading
              ? mode === "signup"
                ? "Creating..."
                : "Signing in..."
              : mode === "signup"
                ? "Sign Up"
                : "Sign In"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-3 text-sm ${
              message.type === "error"
                ? "text-[hsl(0_84.2%_60.2%)]"
                : "text-[hsl(114,85%,41%)]"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
